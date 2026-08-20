# Paquete offline de Windows

En una máquina de preparación conectada y con Docker, agregue el certificado PEM
para `172.16.45.212` en `deploy/caddy/certificates/` y ejecute
`Build-OfflineBundle.ps1`. Este proceso sella código e imágenes en un ZIP sin
descargas durante la instalación. Para generar `SIGES-Server-Setup.exe`, ejecute
después `ISCC.exe deploy\windows\SIGES-Server-Setup.iss` con Inno Setup.

El ejecutable requiere Docker Desktop ya instalado en el servidor objetivo. El
paquete incluye un `pg_dump` consistente de la base actual y el volumen de
MinIO: conserva usuarios, inventario, estados, telemetría, descubrimientos,
branding y adjuntos tal como estaban al sellar el paquete. El instalador restaura
esos datos antes de publicar API/Web y levanta el perfil `monitoring`; no crea
datos demo ni reinicializa el inventario.
