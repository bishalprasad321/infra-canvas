# Create downloads directory if not exists
New-Item -ItemType Directory -Force -Path "apps/api/static/downloads"

# Go to cli folder to resolve dependency modules
Push-Location "apps/cli"

Write-Host "Building CLI for Windows (64-bit)..."
$env:GOOS="windows"; $env:GOARCH="amd64"
go build -ldflags="-s -w" -o ../api/static/downloads/infracanvas-windows-amd64.exe main.go

Write-Host "Building CLI for macOS (Apple Silicon)..."
$env:GOOS="darwin"; $env:GOARCH="arm64"
go build -ldflags="-s -w" -o ../api/static/downloads/infracanvas-darwin-arm64 main.go

Write-Host "Building CLI for macOS (Intel)..."
$env:GOOS="darwin"; $env:GOARCH="amd64"
go build -ldflags="-s -w" -o ../api/static/downloads/infracanvas-darwin-amd64 main.go

Write-Host "Building CLI for Linux (64-bit)..."
$env:GOOS="linux"; $env:GOARCH="amd64"
go build -ldflags="-s -w" -o ../api/static/downloads/infracanvas-linux-amd64 main.go

Pop-Location

Write-Host "All CLI binaries successfully compiled and placed in apps/api/static/downloads!" -ForegroundColor Green
