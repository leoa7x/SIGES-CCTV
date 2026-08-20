[CmdletBinding()]
param([string]$Output = (Join-Path $PSScriptRoot 'out'), [string]$CertificateDirectory = (Join-Path $PSScriptRoot '..\caddy\certificates'))
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
if (git -C $root status --porcelain) { throw 'El repositorio debe estar limpio antes de sellar un instalador.' }
if (-not (Test-Path (Join-Path $CertificateDirectory 'siges.crt')) -or -not (Test-Path (Join-Path $CertificateDirectory 'siges.key'))) { throw 'Incluya un certificado PEM y clave PEM para la IP/host final antes de sellar el paquete.' }
$stage = Join-Path $Output 'payload'; Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$stage\images","$stage\source","$stage\certificates","$stage\data" | Out-Null
Push-Location $root
try {
  docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.single-host.yml -f docker-compose.lan.yml build
  $images = docker compose -f docker-compose.yml -f docker-compose.production.yml -f docker-compose.single-host.yml -f docker-compose.lan.yml config --images | Sort-Object -Unique
  docker image save -o "$stage\images\siges-images.tar" $images
  git archive --format=zip --output="$stage\source\siges-source.zip" HEAD
  Copy-Item "$CertificateDirectory\siges.crt","$CertificateDirectory\siges.key" "$stage\certificates"
  docker exec siges-postgres sh -ec 'pg_dump -U siges -Fc -d siges_cctv -f /tmp/siges-migration.dump'
  docker cp siges-postgres:/tmp/siges-migration.dump "$stage\data\siges-cctv.dump"
  $minioVolume = docker volume ls -q --filter 'label=com.docker.compose.project=siges-cctv' --filter 'label=com.docker.compose.volume=minio_data'
  if (!$minioVolume) { $minioVolume = 'siges-cctv_minio_data' }
  docker run --rm -v "${minioVolume}:/source:ro" -v "${stage}\data:/backup" alpine:3.21 sh -ec 'cd /source && tar -czf /backup/minio-data.tar.gz .'
  @{ format = 'siges-offline-migration-v1'; createdAt = (Get-Date).ToUniversalTime().ToString('o'); database = 'siges-cctv.dump'; minio = 'minio-data.tar.gz' } | ConvertTo-Json | Set-Content -Encoding utf8 "$stage\data\manifest.json"
  Copy-Item (Join-Path $PSScriptRoot 'Install-SIGES.ps1') $Output -Force
  Compress-Archive -Path "$stage\*",(Join-Path $Output 'Install-SIGES.ps1') -DestinationPath (Join-Path $Output 'SIGES-Server-Package.zip') -Force
} finally { Pop-Location }
Write-Host "Paquete offline creado: $Output\SIGES-Server-Package.zip"
