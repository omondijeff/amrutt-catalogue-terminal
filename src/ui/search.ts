import type { Product } from "./types";

type SearchResponse = {
  hits?: {
    hits?: Array<{
      _id?: string;
      _source?: {
        post_type?: string;
        post_title?: string;
        permalink?: string;
        thumbnail?: { src?: string };
        gallery_image_urls?: string[];
        meta?: any;
        terms?: any;
      };
    }>;
  };
};

export async function searchProducts(
  workerUrl: string,
  query: string,
): Promise<Product[]> {
  const normalized = normalizeQuery(query);

  const body = buildEsBody(normalized);

  const res = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Search service error (${res.status})`);
  }

  const json = (await res.json()) as SearchResponse;
  const hits = json.hits?.hits ?? [];

  const products: Product[] = [];

  for (const h of hits) {
    const s = h._source;
    if (!s || s.post_type !== "product") continue;

    const terms = s.terms ?? {};

    const categories = (terms.product_cat ?? []).map((t: any) => t.name).filter(Boolean);
    const tags = (terms.product_tag ?? []).map((t: any) => t.name).filter(Boolean);
    const color = (terms.pa_color ?? []).map((t: any) => t.name).filter(Boolean);
    const size = (terms.pa_size ?? []).map((t: any) => t.name).filter(Boolean);

    const { price, regularPrice } = extractPrices(s.meta ?? {});

    let image = s.thumbnail?.src ?? "";
    const images = (s.gallery_image_urls ?? []).filter(Boolean);
    if (!image && images.length) {
      image = images[0];
    }

    products.push({
      id: h._id ?? s.permalink ?? s.post_title ?? "",
      title: s.post_title ?? "",
      permalink: s.permalink ?? "",
      image,
      images,
      categories,
      tags,
      color,
      size,
      price,
      regularPrice,
    });
  }

  return products;
}

function normalizeQuery(raw: string): string {
  let q = raw.normalize ? raw.normalize("NFC") : raw;
  q = q.replace(/\s+/g, " ").trim();
  return q;
}

function buildEsBody(query: string): any {
  if (!query) {
    return {
      query: { match_all: {} },
      size: 500,
      from: 0,
    };
  }

  const variants = new Set<string>();
  variants.add(query);

  const compact = query.replace(/\s+/g, "");
  if (compact && compact !== query) variants.add(compact);

  if (!query.includes(" ")) {
    const runes = Array.from(query);
    for (let i = 1; i < runes.length; i++) {
      if (isLetter(runes[i - 1]) && isDigit(runes[i])) {
        const spaced = `${runes.slice(0, i).join("")} ${runes.slice(i).join("")}`;
        if (spaced !== query) variants.add(spaced);
        break;
      }
    }
  }

  const should: any[] = [];
  for (const v of variants) {
    should.push({
      multi_match: {
        query: v,
        fields: ["post_title^2", "post_content", "post_excerpt"],
      },
    });
  }

  return {
    query: {
      bool: {
        should,
        minimum_should_match: 1,
      },
    },
    size: 500,
    from: 0,
  };
}

function isLetter(ch: string): boolean {
  return /[A-Za-z]/.test(ch);
}

function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

function extractPrices(meta: any): { price: string; regularPrice: string } {
  const price = formatMetaPrice(meta?._price);
  const regular = formatMetaPrice(meta?._regular_price);
  return {
    price: price ? `KSh ${price}` : "",
    regularPrice: regular ? `KSh ${regular}` : "",
  };
}

function formatMetaPrice(v: any): string {
  if (v == null) return "";

  if (typeof v === "string") {
    return v;
  }

  if (Array.isArray(v) && v.length) {
    return formatMetaPrice(v[0]);
  }

  if (typeof v === "object") {
    if (typeof v.raw === "string" && v.raw) return v.raw;
    if (typeof v.value === "string" && v.value) return v.value;
    if (typeof v.double === "number") return numberToString(v.double);
    if (typeof v.long === "number") return numberToString(v.long);
    return "";
  }

  if (typeof v === "number") {
    return numberToString(v);
  }

  return "";
}

function numberToString(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

