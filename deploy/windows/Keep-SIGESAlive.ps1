[CmdletBinding()]
param([string]$Distribution = 'Ubuntu-24.04')

$ErrorActionPreference = 'Continue'
$wsl = Join-Path $env:WINDIR 'System32\wsl.exe'
$command = 'until docker info >/dev/null 2>&1; do sleep 2; done; cd /opt/siges-cctv || exit 10; docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.single-host.yml -f docker-compose.lan.yml up -d; exec tail -f /dev/null'

# WSL stops when its last foreground client is closed. Keep one hidden client
# alive and restart it if WSL exits unexpectedly.
while ($true) {
  & $wsl -d $Distribution -u root --exec /bin/bash -lc $command
  Start-Sleep -Seconds 5
}
