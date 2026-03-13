import React, { useEffect, useMemo, useState } from "react";
import { searchProducts } from "./search";
import type { Product } from "./types";

const WORKER_URL =
  import.meta.env.VITE_CATALOGUE_WORKER_URL &&
  import.meta.env.VITE_CATALOGUE_WORKER_URL.trim().length > 0
    ? import.meta.env.VITE_CATALOGUE_WORKER_URL
    : "https://amrutt-search-worker.jeffomondi-eng.workers.dev";

export const App: React.FC = () => {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalIndex, setModalIndex] = useState(0);
  const [modalFullscreen, setModalFullscreen] = useState(false);
  const [appFullscreen, setAppFullscreen] = useState(false);

  const displayHost = useMemo(() => {
    if (typeof window === "undefined") return "";

    const { hostname, port, host } = window.location;
    const effectivePort = port || "8080";

    // When running on localhost, hint how to open from other devices.
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `<this-pc-ip>:${effectivePort}`;
    }

    return host || "";
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      const fsElement =
        document.fullscreenElement ||
        // @ts-expect-error vendor-prefixed properties
        document.webkitFullscreenElement;
      setAppFullscreen(Boolean(fsElement));
    };
    document.addEventListener("fullscreenchange", handler);
    // @ts-expect-error vendor-prefixed event
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      // @ts-expect-error
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  const toggleAppFullscreen = () => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const fsElement =
      document.fullscreenElement ||
      // @ts-expect-error
      document.webkitFullscreenElement;
    if (!fsElement) {
      const req =
        root.requestFullscreen ||
        // @ts-expect-error
        root.webkitRequestFullscreen;
      if (req) {
        req.call(root);
      }
    } else {
      const exit =
        document.exitFullscreen ||
        // @ts-expect-error
        document.webkitExitFullscreen;
      if (exit) {
        exit.call(document);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchProducts(WORKER_URL, query);
        if (cancelled) return;
        setItems(res);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Could not load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const openModal = (product: Product) => {
    setModalProduct(product);
    setModalIndex(0);
    setModalFullscreen(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalProduct(null);
    setModalIndex(0);
    setModalFullscreen(false);
  };

  const modalImages = modalProduct?.images ?? [];

  const setModalImageIndex = (next: number) => {
    if (!modalImages.length) return;
    let idx = next;
    if (idx < 0) idx = modalImages.length - 1;
    if (idx >= modalImages.length) idx = 0;
    setModalIndex(idx);
  };

  return (
    <div className="page">
      {/* Top network/IP bar */}
      <header className="page-header-bar">
        <div className="page-header-bar-left">
          <img
            src="https://www.amruttkenya.co.ke/amrutt-landscape.png"
            alt="Amrutt Kenya"
            className="page-logo"
          />
          <div className="page-header-title">
            <span className="page-header-kicker">In‑store catalogue</span>
            <span className="page-header-main-title">
              Premium footwear & accessories
            </span>
          </div>
        </div>
        <div className="page-header-bar-right">
          <span className="hero-chip">Shop URL</span>
          <span className="hero-url mono">
            {displayHost ? `http://${displayHost}` : "http://<this-pc-ip>:8080"}
          </span>
          <button
            type="button"
            className="page-fullscreen-toggle"
            onClick={toggleAppFullscreen}
          >
            {appFullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </header>

      {/* Main content shell */}
      <main className="page-shell">
        {/* Page header, echoing storefront `PageHeader` */}
        <section className="page-hero">
          <div className="page-hero-content">
            <div className="page-hero-text">
              <p className="page-hero-kicker">Catalogue mode</p>
              <h1 className="page-hero-title">Shop Collection</h1>
              <p className="page-hero-subtitle">
                Showing {items.length} live products from Amrutt Kenya. Use this
                screen to help customers browse, compare and view details.
              </p>
            </div>
            <div className="page-hero-stats">
              <span className="page-hero-stat-label">Status</span>
              <span className="page-hero-stat-pill">
                {loading ? "Syncing catalogue…" : "Connected to search worker"}
              </span>
            </div>
            <div className="page-hero-watermark">AMRUTT</div>
          </div>
        </section>

        {/* Search + grid */}
        <section className="page-main">
          <div className="page-search-row">
            <div className="search-bar">
              <input
                type="text"
                name="q"
                placeholder="Search products (e.g. TN312, sandals 42 black, gumboot)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="button" onClick={() => setQuery(query.trim())}>
                Search
              </button>
            </div>
            <div className="stats">
              {loading
                ? "Loading…"
                : items.length
                ? `${items.length} product${items.length === 1 ? "" : "s"}`
                : "No products"}
            </div>
          </div>
          {error && <div className="error">{error}</div>}

          <div className="app-main-scroll">
            <div className="grid">
              {items.map((p) => (
                <article
                  key={p.id}
                  className="card"
                  onClick={() => openModal(p)}
                >
                  <div className="card-image-wrap">
                    {p.image ? (
                      <img src={p.image} alt={p.title} />
                    ) : (
                      <div className="card-image-placeholder" />
                    )}
                  </div>

                  <div className="card-body">
                    {(p.categories.length || p.tags.length) && (
                      <span className="card-category">
                        {p.categories[0] ?? p.tags[0] ?? "Footwear"}
                      </span>
                    )}

                    <h3 className="card-title">{p.title}</h3>

                    <div className="card-pill-row">
                      {p.tags.map((t) => (
                        <span key={t} className="pill">
                          {t}
                        </span>
                      ))}
                      {p.color.map((c) => (
                        <span key={`c-${c}`} className="pill">
                          Color: {c}
                        </span>
                      ))}
                      {p.size.map((s) => (
                        <span key={`s-${s}`} className="pill">
                          Size: {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {modalOpen && modalProduct && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className={
              modalFullscreen ? "modal-panel modal-panel-full" : "modal-panel"
            }
          >
            <div className="modal-header">
              <div className="modal-title">{modalProduct.title}</div>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="modal-toggle-full"
                  onClick={() => setModalFullscreen((v) => !v)}
                >
                  {modalFullscreen ? "Exit full screen" : "Full screen"}
                </button>
                <button
                  className="modal-close"
                  type="button"
                  onClick={closeModal}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-main">
                {modalImages.length > 1 && (
                  <button
                    className="modal-nav modal-nav-left"
                    type="button"
                    onClick={() => setModalImageIndex(modalIndex - 1)}
                  >
                    &lsaquo;
                  </button>
                )}
                <img
                  src={modalImages[modalIndex]}
                  alt={modalProduct.title}
                />
                {modalImages.length > 1 && (
                  <button
                    className="modal-nav modal-nav-right"
                    type="button"
                    onClick={() => setModalImageIndex(modalIndex + 1)}
                  >
                    &rsaquo;
                  </button>
                )}
              </div>
              {!modalFullscreen && (
                <div className="modal-side">
                  <div className="modal-meta">
                    {modalImages.length
                      ? `${modalIndex + 1} / ${modalImages.length} image${
                          modalImages.length === 1 ? "" : "s"
                        }`
                      : "No images"}
                  </div>

                  <div className="modal-product-meta">
                    {modalProduct.categories.length > 0 && (
                      <div className="modal-field">
                        <span className="modal-field-label">Category</span>
                        <span className="modal-field-value">
                          {modalProduct.categories.join(", ")}
                        </span>
                      </div>
                    )}

                    {modalProduct.color.length > 0 && (
                      <div className="modal-field">
                        <span className="modal-field-label">Colour</span>
                        <span className="modal-field-value">
                          {modalProduct.color.join(", ")}
                        </span>
                      </div>
                    )}

                    {modalProduct.size.length > 0 && (
                      <div className="modal-field">
                        <span className="modal-field-label">Size</span>
                        <span className="modal-field-value">
                          {modalProduct.size.join(", ")}
                        </span>
                      </div>
                    )}

                    {modalProduct.tags.length > 0 && (
                      <div className="modal-field">
                        <span className="modal-field-label">Tags</span>
                        <span className="modal-field-value">
                          {modalProduct.tags.join(", ")}
                        </span>
                      </div>
                    )}

                    {modalProduct.permalink && (
                      <div className="modal-field">
                        <span className="modal-field-label">Product page</span>
                        <a
                          href={modalProduct.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="modal-link"
                        >
                          Open in browser
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="thumb-row" id="modal-thumbs">
                    {modalImages.map((src, idx) => (
                      <img
                        key={src + idx}
                        src={src}
                        alt={modalProduct.title}
                        className={
                          idx === modalIndex ? "modal-thumb-active" : ""
                        }
                        onClick={() => setModalImageIndex(idx)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

