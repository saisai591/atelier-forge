param(
  [string]$HostName = "192.168.1.57",
  [string]$SshUser = "aos",
  [string]$KeyPath = ".\aos_deploy_ed25519"
)

$ErrorActionPreference = "Stop"

function Test-HttpRoute {
  param([string]$Path)
  $url = "http://$HostName$Path"
  $lastCode = "000"
  $lastSize = "0"

  for ($attempt = 1; $attempt -le 12; $attempt++) {
    $result = curl.exe -sS -o NUL -w "%{http_code} %{size_download}" $url
    $parts = $result.Trim().Split(" ")
    $lastCode = $parts[0]
    $lastSize = $parts[1]
    if ($lastCode -eq "200") {
      Write-Host "OK HTTP $Path ($lastSize bytes)"
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "HTTP check failed: $url returned $lastCode after retries"
}

function Test-Remote {
  param([string]$Command)
  ssh -i $KeyPath -o StrictHostKeyChecking=no "$SshUser@$HostName" $Command
}

$routes = @(
  "/",
  "/pxe",
  "/erp",
  "/mobile",
  "/guide",
  "/app",
  "/api/health",
  "/api/forge/pxe/status",
  "/api/atelier-erp/overview",
  "/api/atelier-erp/receptions",
  "/api/atelier-erp/shipments",
  "/api/atelier-erp/pallets",
  "/api/atelier-erp/documents",
  "/api/forge/pxe/media/files",
  "/api/forge/pxe/media/external-sources",
  "/api/forge/pxe/wim-recipes",
  "/api/forge/pxe/wim-images",
  "/api/forge/pxe/wim-builds",
  "/api/forge/pxe/driver-packs",
  "/api/forge/pxe/unattend-profiles",
  "/api/forge/pxe/deployment-profiles"
)

foreach ($route in $routes) {
  Test-HttpRoute -Path $route
}

Test-Remote "test -f /opt/aos-dashboard/spa_server.py"
Test-Remote "sudo systemctl --no-pager --plain is-active aos-dashboard aos-backend forge-nginx-pxe"
Test-Remote "df -h / /app/deploy 2>/dev/null || df -h /"

Write-Host "Appliance verification completed."
