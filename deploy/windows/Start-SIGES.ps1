[CmdletBinding()]
param([int]$TimeoutSeconds = 120)

$ErrorActionPreference = 'Stop'
Start-ScheduledTask -TaskName 'SIGES WSL Keepalive'

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    if ($client.ConnectAsync('localhost', 443).Wait(1000) -and $client.Connected) {
      Write-Host 'SIGES esta activo: https://localhost' -ForegroundColor Green
      exit 0
    }
  } finally {
    $client.Dispose()
  }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)

throw 'SIGES no abrio el puerto 443 dentro del tiempo esperado. Use el acceso Estado SIGES para revisar.'
