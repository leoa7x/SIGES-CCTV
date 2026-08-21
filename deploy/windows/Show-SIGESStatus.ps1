[CmdletBinding()]
param()

$task = Get-ScheduledTask -TaskName 'SIGES WSL Keepalive' -ErrorAction SilentlyContinue
if (!$task) {
  Write-Host 'No existe la tarea SIGES WSL Keepalive.' -ForegroundColor Red
  exit 1
}

$client = [Net.Sockets.TcpClient]::new()
try {
  $https = $client.ConnectAsync('localhost', 443).Wait(1500) -and $client.Connected
} finally {
  $client.Dispose()
}

Write-Host "Tarea automatica: $($task.State)"
Write-Host "HTTPS localhost:  $https"
if ($https) {
  Write-Host 'SIGES esta funcionando correctamente.' -ForegroundColor Green
  exit 0
}
Write-Host 'SIGES no esta disponible. Ejecute el acceso Iniciar SIGES.' -ForegroundColor Yellow
exit 1
