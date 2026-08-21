[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\SIGES-CCTV',
  [string]$ServerIp = '172.16.45.212',
  [string]$LanCidr = '172.16.45.0/24',
  [string]$AdminEmail = 'admin@sigescctv.co',
  [SecureString]$AdminPassword
)

$ErrorActionPreference = 'Stop'
function Require-Admin { if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Ejecute el instalador como Administrador.' } }
function Secret { $bytes = New-Object byte[] 36; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes).Replace('+','A').Replace('/','B').Replace('=','') }
function Plain([SecureString]$Value) { if (!$Value) { $Value = Read-Host 'Contraseña inicial del administrador SIGES' -AsSecureString }; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) } }

Require-Admin
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop con Docker Compose v2 debe estar instalado antes de ejecutar este paquete offline.' }
docker version | Out-Null
foreach ($port in 80,443) { if (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue) { throw "El puerto $port ya está en uso." } }
$payload = Join-Path $PSScriptRoot 'payload'
foreach ($file in 'images\siges-images.tar','source\siges-source.zip','certificates\siges.crt','certificates\siges.key','data\siges-cctv.dump','data\minio-data.tar.gz','data\manifest.json') { if (-not (Test-Path (Join-Path $payload $file))) { throw "Falta el artefacto offline: $file" } }
New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
Expand-Archive -Force (Join-Path $payload 'source\siges-source.zip') $InstallRoot
Copy-Item -Force (Join-Path $payload 'certificates\siges.crt') (Join-Path $InstallRoot 'deploy\caddy\certificates\siges.crt')
Copy-Item -Force (Join-Path $payload 'certificates\siges.key') (Join-Path $InstallRoot 'deploy\caddy\certificates\siges.key')
docker load -i (Join-Path $payload 'images\siges-images.tar') | Out-Host
$adminPasswordPlain = Plain $AdminPassword
$envFile = @"
COMPOSE_PROFILES=monitoring
NODE_ENV=production
SIGES_STRICT_PRODUCTION=true
SIGES_SINGLE_HOST=true
SIGES_BIND_ADDRESS=0.0.0.0
SIGES_PUBLIC_HOST=$ServerIp
POSTGRES_USER=siges
POSTGRES_PASSWORD=$(Secret)
POSTGRES_DB=siges_cctv
JWT_SECRET=$(Secret)
JWT_REFRESH_SECRET=$(Secret)
JWT_EXPIRES_IN=30d
CAMERA_SECRET_KEY=$(Secret)
MONITOR_API_TOKEN=$(Secret)
NETWORK_TELEMETRY_INGEST_TOKEN=$(Secret)
SEED_ADMIN_EMAIL=$AdminEmail
SEED_ADMIN_PASSWORD=$adminPasswordPlain
MINIO_USER=siges_minio
MINIO_PASSWORD=$(Secret)
MINIO_BUCKET=siges-cctv
MINIO_PUBLIC_URL=https://$ServerIp/storage
GRAFANA_ADMIN_USER=siges_admin
GRAFANA_ADMIN_PASSWORD=$(Secret)
GRAFANA_ANONYMOUS_ENABLED=true
GRAFANA_ANONYMOUS_ROLE=Viewer
GRAFANA_BASE_URL=https://$ServerIp/grafana
GRAFANA_ORG_ID=1
GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID=node-observability
GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID=network-command-view
CORS_ORIGIN=https://$ServerIp,https://localhost
NEXT_PUBLIC_API_URL=/api
REDPANDA_BROKERS=redpanda:9092
NTOPNG_BASE_URL=http://host.docker.internal:3002
NTOPNG_USERNAME=ntopng
NTOPNG_PASSWORD=$(Secret)
NTOPNG_COLLECTION_INTERVAL_SECONDS=20
CENTER_MONITORING_INTERVAL_MS=21600000
CENTER_ASSET_STALE_MS=600000
HEARTBEAT_INTERVAL_MS=15000
HEARTBEAT_FAILURE_THRESHOLD=3
DEGRADED_AUTO_RECOVER_ENABLED=true
HEARTBEAT_CONCURRENCY=20
HEARTBEAT_TCP_FALLBACK_PORTS=80,443,8291,8728
MONITOR_STATE_TRANSITIONS_ENABLED=false
CAMERA_HEARTBEAT_INTERVAL_MS=30000
CAMERA_HEARTBEAT_PORTS=554,80,37777
LAN_ORANGUTAN_HOME=/app/tools/LAN-Orangutan
LAN_ORANGUTAN_CMD=python3 /app/apps/api/scripts/run_lan_orangutan_scan.py {target}
LAN_DISCOVERY_AGENT_PORT=4010
LAN_DISCOVERY_AGENT_TOKEN=$(Secret)
LAN_DISCOVERY_INTERFACE=
"@
Set-Content -NoNewline -Encoding utf8 (Join-Path $InstallRoot '.env.production') $envFile
Push-Location $InstallRoot
try {
  $compose = @('--env-file','.env.production','-f','docker-compose.yml','-f','docker-compose.production.yml','-f','docker-compose.single-host.yml','-f','docker-compose.lan.yml')
  docker compose @compose up -d --no-build postgres redis redpanda minio
  foreach ($i in 1..30) { if ((docker inspect -f '{{.State.Health.Status}}' siges-postgres 2>$null) -eq 'healthy') { break }; Start-Sleep -Seconds 2 }
  Get-Content -AsByteStream (Join-Path $payload 'data\siges-cctv.dump') | docker exec -i siges-postgres pg_restore -U siges -d siges_cctv --clean --if-exists --no-owner
  docker run --rm -v siges-cctv_minio_data:/target -v "$payload\data:/backup:ro" alpine:3.21 sh -ec 'cd /target && tar -xzf /backup/minio-data.tar.gz'
  docker compose @compose up -d --no-build
  $ready = $false; foreach ($i in 1..30) { try { if ((Invoke-WebRequest -UseBasicParsing -SkipCertificateCheck "https://$ServerIp/api/display/overview").StatusCode -eq 200) { $ready = $true; break } } catch {}; Start-Sleep -Seconds 2 }
  if (!$ready) { throw 'SIGES no respondió a tiempo. Ejecute docker compose logs desde C:\SIGES-CCTV.' }
} finally { Pop-Location }
& (Join-Path $InstallRoot 'deploy\windows\Register-SIGESAutostart.ps1')
Write-Host "SIGES instalado: https://$ServerIp" -ForegroundColor Green
Write-Host "NOC público: https://$ServerIp/display/noc" -ForegroundColor Green
