Param(
    [string]$RepoUrl = "https://github.com/your-org/amrutt-search-worker.git",
    [string]$AppDir = "amrutt-search-worker",
    [string]$ContainerName = "amrutt-catalogue-terminal",
    [string]$ImageName = "amrutt-catalogue-terminal",
    [string]$CatalogueWorkerUrl = "https://amrutt-search-worker.jeffomondi-eng.workers.dev"
)

Write-Host "==> Checking for Docker..." -ForegroundColor Cyan
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed or not in PATH. Attempting installation..." -ForegroundColor Yellow

    # Prefer winget for automated install of Docker Desktop on supported Windows
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        try {
            Write-Host "Using winget to install Docker Desktop..." -ForegroundColor Cyan
            winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
        } catch {
            Write-Error "Failed to install Docker Desktop via winget. Please install Docker Desktop manually from https://www.docker.com/products/docker-desktop/ and re-run this script."
            exit 1
        }
    } else {
        Write-Error "winget is not available. Please install Docker Desktop from https://www.docker.com/products/docker-desktop/ and re-run this script."
        exit 1
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker still not available after attempted installation. Please open Docker Desktop once to finish setup, then re-run this script."
        exit 1
    }
}

Write-Host "==> Cloning or updating repository..." -ForegroundColor Cyan
if (Test-Path "$AppDir\.git") {
    Write-Host "Repository exists at '$AppDir', pulling latest..."
    git -C $AppDir pull --ff-only 2>$null
} else {
    Write-Host "Cloning $RepoUrl into $AppDir ..."
    git clone $RepoUrl $AppDir
}

Set-Location "$AppDir\amrutt-catalogue-terminal"

Write-Host "==> Building Docker image '$ImageName'..." -ForegroundColor Cyan
docker build -t $ImageName --build-arg CATALOGUE_WORKER_URL=$CatalogueWorkerUrl .

Write-Host "==> Stopping old container (if any)..." -ForegroundColor Cyan
$existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
if ($existing) {
    docker rm -f $ContainerName | Out-Null
}

Write-Host "==> Detecting LAN IP..." -ForegroundColor Cyan
try {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 `
        | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } `
        | Select-Object -First 1 -ExpandProperty IPAddress)
} catch {
    $ip = $null
}

Write-Host "==> Starting new container..." -ForegroundColor Cyan
if ($ip) {
    $publicHost = "$ip:8080"
} else {
    $publicHost = ""
}

docker run -d `
  --name $ContainerName `
  -p 8080:80 `
  --restart unless-stopped `
  $ImageName | Out-Null

Write-Host "==> Container started." -ForegroundColor Green

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Yellow

if ($ip) {
    Write-Host "Amrutt Catalogue Terminal is running on:" -ForegroundColor Yellow
    Write-Host "  http://$ip:8080" -ForegroundColor Green
    Write-Host "Open this URL from other devices on the same Wi-Fi/LAN."
} else {
    Write-Host "Amrutt Catalogue Terminal is running on port 8080." -ForegroundColor Yellow
    Write-Host "Open this PC's IP on port 8080 from other devices on the LAN." -ForegroundColor Yellow
    Write-Host "Example: http://<this-pc-ip>:8080"
}

Write-Host "=======================================================" -ForegroundColor Yellow

