[CmdletBinding()]
param([string]$Distribution = 'Ubuntu-24.04')

$ErrorActionPreference = 'Stop'
$operationsDirectory = Join-Path $env:ProgramData 'SIGES-CCTV'
New-Item -ItemType Directory -Force $operationsDirectory | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'Keep-SIGESAlive.ps1') $operationsDirectory
Copy-Item -Force (Join-Path $PSScriptRoot 'Start-SIGES.ps1') $operationsDirectory
Copy-Item -Force (Join-Path $PSScriptRoot 'Show-SIGESStatus.ps1') $operationsDirectory

$keepalive = Join-Path $operationsDirectory 'Keep-SIGESAlive.ps1'
$taskAction = New-ScheduledTaskAction `
  -Execute (Join-Path $PSHOME 'powershell.exe') `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$keepalive`" -Distribution $Distribution"
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$taskSettings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 99 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName 'SIGES WSL Keepalive' -Action $taskAction -Trigger $taskTrigger -Settings $taskSettings -User $env:USERNAME -RunLevel Highest -Force | Out-Null

$desktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$startScript = Join-Path $operationsDirectory 'Start-SIGES.ps1'
$statusScript = Join-Path $operationsDirectory 'Show-SIGESStatus.ps1'
Set-Content -Encoding ascii (Join-Path $desktop 'Iniciar SIGES.cmd') "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$startScript`"`r`npause`r`n"
Set-Content -Encoding ascii (Join-Path $desktop 'Estado SIGES.cmd') "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$statusScript`"`r`npause`r`n"

Start-ScheduledTask -TaskName 'SIGES WSL Keepalive'
Write-Host 'Inicio automatico oculto y accesos manuales de SIGES registrados.' -ForegroundColor Green
