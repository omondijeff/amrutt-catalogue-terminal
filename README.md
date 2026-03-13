## Amrutt Catalogue Terminal

A small **React + Vite + Docker** app that gives shop attendants a fast, beautiful in‑store view of all products coming from the Amrutt search worker (Cloudflare Worker + Searchly/Elasticsearch).

Designed to run on a shop PC (Windows, macOS, or Linux) and be accessed from any device on the same Wi‑Fi/LAN.

---

## Features

- **Live product data** from the existing search worker:
  - Pulls directly from `shopamruttkenyacoke-post-1` via `https://amrutt-search-worker.jeffomondi-eng.workers.dev`.
  - Shows main image + full gallery (`gallery_image_urls`) for each product.
- **Shop‑friendly UI**
  - Full‑width, three‑column grid of product cards.
  - Branded hero header with Amrutt logo and the local shop URL.
  - Responsive design for desktop, tablet, and phone.
- **Image gallery**
  - Tap/click a product to open a full‑screen-ish viewer.
  - Arrow buttons + keyboard arrows to move between images.
  - Thumbnails for quick jumping; shows `current / total` count.
- **Realtime search**
  - Debounced search as you type (no page reload).
  - Smart handling of codes like `TN312` vs `TN 312` (queries multiple variants).
  - Falls back to `match_all` when search box is empty to show the whole catalogue.

---

## Architecture overview

- **Frontend app**: React + TypeScript single‑page app (SPA) built with Vite  
  - `src/main.tsx` bootstraps the React app into `index.html`.  
  - `src/ui/App.tsx` is the main catalogue UI.  
  - Styles live in `src/ui/styles.css`.
- **Search worker** (already built)
  - Deployed Cloudflare Worker that proxies to Searchly, injects static nav hits, and returns enriched product documents (including `gallery_image_urls`).
- **Search client**
  - The browser app calls the worker directly from the frontend via `src/ui/search.ts`.  
  - The base URL is controlled by `VITE_CATALOGUE_WORKER_URL` (or defaults to the production worker URL).
- **Containerization**
  - Multi‑stage Dockerfile builds the React app and serves static assets from Nginx.
  - Default container port: `80`.

---

## Prerequisites

- **General**
  - Git
  - Internet access (to pull this repo and call the search worker)
- **Runtime**
  - Docker (Docker Desktop on Windows/macOS, Docker Engine on Linux)

If Docker is missing, the setup scripts will try to install it (details below).

---

## Quick start (recommended scripts)

The `setup` scripts are meant to be run on the **shop PC** that will host the catalogue.
They will:

1. Ensure Docker is installed (and try to install it if missing).
2. Clone or pull this repo.
3. Build the Docker image (Node/Vite build → static files).
4. Start the container and publish it on port `8080` on the host.
5. Print the LAN URL for other devices.

### Windows (PowerShell)

In PowerShell, on the shop PC:

```powershell
cd ~
git clone https://github.com/omondijeff/amrutt-search-worker.git
cd amrutt-search-worker/amrutt-catalogue-terminal
.\setup.ps1
```

What it does:

- Checks for `docker`:
  - If missing and `winget` is available, tries:
    - `winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements`
  - Otherwise instructs to manually install Docker Desktop.
- Builds the Docker image `amrutt-catalogue-terminal`.
- Stops any existing `amrutt-catalogue-terminal` container.
- Detects the LAN IP and starts the container with:
  - `-p 8080:8080`
  - `CATALOGUE_WORKER_URL` pointing at your workers.dev URL.
  - `CATALOGUE_PUBLIC_HOST` set to `<lan-ip>:8080` (used in the header URL).
- Prints something like:

```text
Amrutt Catalogue Terminal is running on:
  http://192.168.100.61:8080
Open this URL from other devices on the same Wi‑Fi/LAN.
```

### macOS / Linux (bash)

On the shop Mac or Linux PC:

```bash
cd ~
git clone https://github.com/omondijeff/amrutt-search-worker.git
cd amrutt-search-worker/amrutt-catalogue-terminal
chmod +x setup.sh
./setup.sh
```

What it does:

- Checks for `docker`:
  - On **Linux**:
    - Tries `apt-get`, `dnf`, or `yum` to install Docker.
  - On **macOS**:
    - Uses Homebrew (`brew install --cask docker`) if available.
    - Otherwise instructs to install Docker Desktop manually.
- Builds the Docker image and restarts the container similar to the Windows script.
- Detects a LAN IP on `hostname -I` (or `ipconfig getifaddr en0` on macOS) and prints:

```text
From other devices on the same Wi‑Fi/LAN, open:
  http://192.168.100.61:8080
```

---

## Manual Docker commands (if you prefer)

If you don’t want to use the scripts, you can run this manually from `amrutt-catalogue-terminal/`:

```bash
docker build \
  --build-arg CATALOGUE_WORKER_URL="https://amrutt-search-worker.jeffomondi-eng.workers.dev" \
  -t amrutt-catalogue-terminal .

docker rm -f amrutt-catalogue-terminal 2>/dev/null || true

docker run -d \
  --name amrutt-catalogue-terminal \
  -p 8080:80 \
  --restart unless-stopped \
  -e CATALOGUE_PUBLIC_HOST="<this-pc-lan-ip>:8080" \
  amrutt-catalogue-terminal
```

Then on any device on the same network:

```text
http://<this-pc-lan-ip>:8080
```

---

## Configuration

Environment variables used by the container / build:

- **`CATALOGUE_WORKER_URL`**  
  - Build‑time ARG used in the Dockerfile to set `VITE_CATALOGUE_WORKER_URL`.  
  - Where the app sends search requests (Cloudflare Worker).

- **`VITE_CATALOGUE_WORKER_URL`**  
  - Frontend‑side env (used in `App.tsx` / `search.ts`).  
  - If not set, defaults to `https://amrutt-search-worker.jeffomondi-eng.workers.dev`.

- **`CATALOGUE_PUBLIC_HOST`**  
  - Optional; used only for displaying the header URL when running in Docker.
  - Example: `192.168.100.61:8080`

---

## Usage notes

- **Listing products**
  - By default (empty search box), the app issues a `match_all` query and shows up to 500 products.
  - You can adjust the `size` inside the Elasticsearch body in `src/ui/search.ts` if your catalogue grows significantly.

- **Searching**
  - Search is debounced on the frontend and uses a `bool` `should` query with multiple variants of the input to handle:
    - `TN312` and `TN 312`
    - General text terms across `post_title`, `post_content`, `post_excerpt`.

- **Image previews**
  - Clicking a card opens a large modal:
    - Left/right arrows (buttons and keyboard) navigate `gallery_image_urls`.
    - Thumbnails highlight the active image and allow jumping.

---

## Development

To run the React/Vite app locally (no Docker, no Go):

```bash
cd amrutt-catalogue-terminal
npm install

# Optionally point to a different worker:
# echo 'VITE_CATALOGUE_WORKER_URL="https://your-worker-url.example.workers.dev"' > .env.local

npm run dev
```

Then open:

```text
http://localhost:8080
```

---

## Deployment checklist for a new shop PC

1. Install Git (if not already installed).
2. Clone this repo from GitHub (or download it).
3. Run:
   - Windows: `setup.ps1` in PowerShell (as user with permission to install apps).
   - macOS/Linux: `./setup.sh` in a terminal.
4. Wait for:
   - Docker install (if needed).
   - Image build and container startup.
5. Note the LAN URL printed by the script.
6. On any device on the same Wi‑Fi/LAN, open that URL in a browser.

