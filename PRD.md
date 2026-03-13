## Amrutt Catalogue Terminal – PRD

### 1. Goal

Provide shop attendants with a fast, simple interface to browse **catalogue-only** products from the Amrutt search worker, see stock / product details, and show customers product images from a tablet/laptop at the shop counter.

### 2. Scope

- **In scope**
  - Small Go application in this folder (`amrutt-catalogue-terminal`), built as:
    - A minimal web server (HTTP + HTML templates) that runs on a local machine in the shop.
  - Query the existing Cloudflare worker:
    - `POST https://amrutt-search-worker.jeffomondi-eng.workers.dev`
    - Elasticsearch-style body, filtered to products with `terms.product_tag.slug === "catalogue-only"`.
  - Display results as a **list/grid of products**:
    - Product name, price (if available), category, key attributes (size, colour where present).
    - Main image and optionally thumbnails from `gallery_image_urls`.
  - Basic product detail view:
    - Bigger images (carousel), description/excerpt, available sizes/colours, permalink link.
  - Simple text search within catalogue-only items (e.g. by name or tag).

- **Out of scope (for now)**
  - Authentication / user accounts.
  - Direct stock mutation or order placement.
  - Offline caching or sync.

### 3. Data sources & contracts

- **Search worker endpoint**
  - URL: `https://amrutt-search-worker.jeffomondi-eng.workers.dev`
  - Method: `POST`
  - Request body (simplified example):
    ```json
    {
      "query": {
        "bool": {
          "must": [
            { "multi_match": { "query": "sandals", "fields": ["post_title^2", "post_content", "post_excerpt"] } },
            { "term": { "terms.product_tag.slug": "catalogue-only" } }
          ]
        }
      },
      "size": 50,
      "from": 0
    }
    ```
  - Response shape (per product hit of interest):
    - `hits.hits[]. _source`:
      - `post_type`: `"product"`
      - `post_title`: string
      - `post_name`: slug
      - `permalink`: product URL
      - `meta`: may include `_price`, `_regular_price`, etc.
      - `terms.product_tag[]`: term objects (look for `slug === "catalogue-only"`).
      - `terms.product_cat[]`: categories.
      - `terms.pa_color[]`, `terms.pa_size[]`: attributes.
      - `thumbnail.src`: main image URL.
      - `gallery_image_urls[]`: array of image URLs, main image first.

### 4. User stories

- **Shop attendant – browse catalogue**
  - As a shop attendant, I can open the app and immediately see all catalogue-only items sorted by name or relevance.
  - I can scroll quickly and see a thumbnail and key info at a glance.

- **Shop attendant – search**
  - As a shop attendant, I can type a search term (e.g. “sandals 42 black”) and see matching catalogue-only products.

- **Shop attendant – show details to customer**
  - As a shop attendant, I can click a product to open a detail view with:
    - Larger product images (from `gallery_image_urls`).
    - Sizes and colours.
    - Price info if available.

### 5. UX / UI

- **List screen**
  - Search box at top (simple text field, submits on Enter or button).
  - Result list/grid:
    - Thumbnail image (first `gallery_image_urls` or `thumbnail.src`).
    - Product title.
    - Optional: short excerpt or category chips.
    - Tag badges for `catalogue-only`, `website-product`, etc., if present.

- **Detail screen**
  - Large primary image with small thumbnails for other `gallery_image_urls`.
  - Title, categories, tags.
  - Price (if `_price` present).
  - Size and colour chips from attributes.

### 6. Technical design (Go)

- **Structure**
  - `main.go`: entrypoint, HTTP server, routes.
  - `search.go`: types and client for calling the worker, unmarshalling JSON.
  - `templates/`:
    - `list.html`: listing page.
    - `detail.html`: detail page.

- **Endpoints (local app)**
  - `GET /`:
    - Query params: `q` (optional search string), `page` (optional).
    - Calls worker with `bool` query combining:
      - `multi_match` on `post_title`, `post_content`, `post_excerpt`.
      - `term` filter for `terms.product_tag.slug: "catalogue-only"`.
    - Renders list using `list.html`.
  - `GET /product`:
    - Query params: `id` (ES `_id`) and/or `slug` (`post_name`).
    - Calls worker with a query to fetch that single product (by ID or slug + tag filter).
    - Renders `detail.html`.

- **Types (simplified)**
  - Go structs to model:
    - `SearchResponse`, `Hit`, `Source`.
    - Nested `Terms` (with `ProductTag`, `ProductCat`, `PaColor`, `PaSize` arrays).

- **Config**
  - Worker URL configurable via env var `CATALOGUE_WORKER_URL`, defaulting to the current workers.dev URL.

### 7. Non‑functional requirements

- **Performance**: Reasonable response time (< 2–3s) on typical shop network for up to a few hundred catalogue-only items.
- **Reliability**: On worker failure, show a clear error message and a “Retry” action; do not crash.
- **Security**: No authentication or write operations; read-only against the public worker endpoint.

### 8. Future extensions (not in current build)

- Offline cache of the latest catalogue-only snapshot to tolerate worker downtime.
- Filtering UI (size, colour, category).
- Tablet-optimized CSS and kiosk mode.

