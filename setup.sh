#!/usr/bin/env bash
set -euo pipefail

# Simple installer/runner for the Amrutt catalogue terminal on Linux/macOS.
# Requirements:
#   - git
#   - docker

REPO_URL_DEFAULT="https://github.com/your-org/amrutt-search-worker.git"
REPO_URL="${REPO_URL:-$REPO_URL_DEFAULT}"
APP_DIR="${APP_DIR:-amrutt-search-worker}"
CONTAINER_NAME="${CONTAINER_NAME:-amrutt-catalogue-terminal}"
IMAGE_NAME="${IMAGE_NAME:-amrutt-catalogue-terminal}"

echo "==> Checking for docker..."
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Attempting installation..."

  OS="$(uname -s || echo unknown)"
  case "$OS" in
    Linux)
      if command -v apt-get >/dev/null 2>&1; then
        echo "Using apt-get to install Docker..."
        sudo apt-get update && sudo apt-get install -y docker.io || {
          echo "Failed to install Docker via apt-get. Please install Docker manually and re-run this script."
          exit 1
        }
      elif command -v dnf >/dev/null 2>&1; then
        echo "Using dnf to install Docker..."
        sudo dnf install -y docker || {
          echo "Failed to install Docker via dnf. Please install Docker manually and re-run this script."
          exit 1
        }
      elif command -v yum >/dev/null 2>&1; then
        echo "Using yum to install Docker..."
        sudo yum install -y docker || {
          echo "Failed to install Docker via yum. Please install Docker manually and re-run this script."
          exit 1
        }
      else
        echo "Unsupported Linux package manager. Please install Docker manually from https://docs.docker.com/engine/install/ and re-run this script."
        exit 1
      fi
      ;;
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        echo "Using Homebrew to install Docker Desktop..."
        brew install --cask docker || {
          echo "Failed to install Docker via Homebrew. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ and re-run this script."
          exit 1
        }
      else
        echo "macOS detected but Homebrew is not available."
        echo "Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ and then re-run this script."
        exit 1
      fi
      ;;
    *)
      echo "Unsupported OS ($OS). Please install Docker manually and re-run this script."
      exit 1
      ;;
  esac

  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker still not available after attempted installation. Please install manually and retry."
    exit 1
  fi
fi

echo "==> Cloning or updating repository..."
if [ -d "$APP_DIR/.git" ]; then
  echo "Repository exists at '$APP_DIR', pulling latest..."
  git -C "$APP_DIR" pull --ff-only || true
else
  echo "Cloning $REPO_URL into $APP_DIR ..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR/amrutt-catalogue-terminal"

echo "==> Building Docker image '$IMAGE_NAME'..."
docker build -t "$IMAGE_NAME" --build-arg CATALOGUE_WORKER_URL="${CATALOGUE_WORKER_URL:-https://amrutt-search-worker.jeffomondi-eng.workers.dev}" .

echo "==> Stopping old container (if any)..."
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

echo "==> Detecting LAN IP to expose..."
IP_CANDIDATE=""
if command -v hostname >/dev/null 2>&1 && hostname -I >/dev/null 2>&1; then
  # Prefer a 192.168.x.x or 10.x.x.x address if present
  for ip in $(hostname -I); do
    case "$ip" in
      192.168.*|10.*)
        IP_CANDIDATE="$ip"
        break
        ;;
    esac
  done
fi

if [ -z "$IP_CANDIDATE" ] && command -v ipconfig >/dev/null 2>&1; then
  # macOS common Wi-Fi interface
  IP_CANDIDATE=$(ipconfig getifaddr en0 2>/dev/null || true)
fi

echo "==> Starting new container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 8080:80 \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo "==> Container started."

echo
echo "======================================================="
echo "Amrutt Catalogue Terminal is running on port 8080."
if [ -n "$IP_CANDIDATE" ]; then
  echo "From other devices on the same Wi-Fi/LAN, open:"
  echo "  http://$IP_CANDIDATE:8080"
else
  echo "Open this PC's IP on port 8080 from other devices on the LAN."
  echo "Example: http://<this-pc-ip>:8080"
fi
echo "======================================================="

