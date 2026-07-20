<div align="center">
  <img src="docs/logo.svg" width="100" alt="SIGES-CCTV Logo" />
  <h1>SIGES-CCTV</h1>
  <p><strong>Sistema Integral de Gestión Operacional CCTV</strong></p>
  <p>Plataforma NOC/SOC de nivel empresarial para operar redes de videovigilancia urbana a gran escala — miles de cámaras, cientos de nodos, un solo centro de control.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=nextdotjs)
  ![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs)
  ![Go](https://img.shields.io/badge/Go-1.22-00ADD8?style=flat-square&logo=go)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+PostGIS-4169E1?style=flat-square&logo=postgresql)
  ![Redpanda](https://img.shields.io/badge/Redpanda-Kafka%20API-FF3333?style=flat-square)
</div>

---

## Qué es SIGES-CCTV

SIGES-CCTV es la plataforma que le da a un centro de monitoreo control total sobre su red de vigilancia: qué existe, qué está vivo, qué se cayó y quién puede tocar qué. Construida para operar a escala real — cientos de nodos, miles de cámaras, múltiples ciudades y equipos de trabajo — sin convertirse en un cuello de botella operativo ni en un riesgo de seguridad.

- **Construye** la topología completa de la red — ciudades, proyectos, CMCs, rutas, nodos, cámaras y fibra óptica — con la certeza de que lo que ves en el sistema es lo que realmente hay en campo
- **Descubre y reconcilia equipos automáticamente**, tanto en cada nodo como en cada centro de monitoreo, sin depender de que alguien actualice el inventario a mano
- **Monitorea en tiempo real** con múltiples niveles de verificación (ICMP, SNMP, ONVIF, telemetría de red) y detecta caídas y equipos fantasma sin intervención humana
- **Visualiza** la red completa sobre un mapa GIS y observabilidad embebida (Grafana), pensado para decisiones operativas en segundos, no en minutos
- **Da acceso a la medida** de cada rol operativo — desde un SUPER_ADMIN hasta un técnico con un único permiso concedido — sin exponer más de lo necesario
- **Muestra video en vivo** de cualquier cámara IP desde el navegador sin exponer jamás sus credenciales al cliente
- **Genera informes oficiales** de monitoreo, infraestructura e incidentes en PDF y CSV, programables o bajo demanda, con histórico auditable de cada corte
- **Levanta alertas operacionales por sí sola** cuando un nodo, CMC o equipo deja de responder — sin esperar a que un operador lo note
- **Se adapta a cada cliente**: identidad institucional propia por ciudad/entidad en la pantalla de acceso

> **Principio de diseño:** Builder, no asset. Todo elemento de la red es registrado y verificado por el sistema — nunca hay que confiar a ciegas en una configuración que nadie revisó.

---

## Por qué SIGES-CCTV

**Seguridad diseñada para infraestructura crítica, no añadida después.** Cada sesión se revalida contra la base de datos en cada solicitud (una cuenta desactivada o un permiso revocado aplica de inmediato, sin esperar a que expire el token). Las credenciales de streaming de cámaras viajan cifradas y nunca se exponen al navegador. Cada acción de escritura pasa por un modelo de permisos granular, no un simple "admin sí / admin no".

**Resiliencia operativa real, no solo en el papel.** Si el bus de eventos (Redpanda) no está disponible al arrancar, la API completa no se cae por eso — el módulo de tiempo real reintenta con backoff y se autorepara en cuanto el servicio vuelve, mientras el resto de la plataforma sigue operando con normalidad.

**El inventario se mantiene solo.** Un equipo confirmado en un centro de monitoreo se marca automáticamente `ONLINE`/`OFFLINE` según lo que el discovery periódico realmente encuentra — no según la última vez que alguien lo editó a mano. Los estados que sí son decisión humana (mantenimiento, degradado) nunca se sobrescriben.

**Cero dependencia de servicios externos para operar.** El descubrimiento de equipos y la identificación de fabricantes por MAC funcionan 100% offline — la plataforma sigue operando aunque no haya salida a internet, un requisito real en redes de infraestructura crítica.

**Multi-entidad desde el diseño.** Cada ciudad o cliente puede tener su propia identidad visual, su propia estructura de proyectos y centros, y su propio esquema de permisos — sin necesitar instalaciones separadas.

**Construida para crecer sin degradarse.** Los listados de incidentes, bitácora, cámaras y nodos están paginados y con búsqueda resuelta en el servidor — no cargan toda la tabla al navegador. Las tablas de mayor crecimiento (telemetría, discovery, log de estados) tienen índices dedicados y una política de retención automática de 90 días, sin tocar jamás los registros de auditoría (incidentes, bitácora, alertas). El daemon de monitoreo y los verificadores de heartbeat sondean con concurrencia acotada, así que un puñado de equipos caídos no retrasa la detección del resto de la red.

---

## Stack tecnológico

### Frontend — `apps/web`
| Tecnología | Uso |
|---|---|
| **Next.js 15** (App Router) | Framework React, SSR + cliente |
| **TypeScript** | Tipado estático |
| **Tailwind CSS** | Estilos con tokens de marca oficiales |
| **MapLibre GL JS** | Mapa GIS offline, 1000+ marcadores con rendimiento |
| **socket.io-client** | WebSocket para estado en tiempo real |
| **Prisma Client** | Tipos compartidos con la API |

### API — `apps/api`
| Tecnología | Uso |
|---|---|
| **NestJS 11** | Framework Node.js modular |
| **TypeScript** | Tipado estático |
| **Prisma 6** | ORM + migraciones |
| **PostgreSQL 16 + PostGIS** | Base de datos principal con soporte geoespacial |
| **socket.io** | Gateway WebSocket por rooms de CMC, autenticado por JWT |
| **Redpanda (Kafka API)** | Consumo de eventos del monitor |
| **MinIO (S3)** | Bucket público (branding/logos) + bucket privado (histórico de informes) |
| **JWT + Passport.js** | Autenticación stateless, revalidada contra la BD en cada solicitud |
| **Roles + permisos granulares** | Control de acceso por rol y por permiso (ver [Roles y permisos](#roles-y-permisos)) |
| **@nestjs/throttler** | Límite de intentos en login (protección contra fuerza bruta) |
| **ffmpeg** | Transcodifica RTSP → MJPEG para preview de cámaras en el navegador |
| **nmap / arp-scan (LAN-Orangutan)** | Discovery de equipos por nodo y por CMC |
| **Swagger** | Documentación de API auto-generada (`/docs`) |

### Monitor — `apps/monitor`
| Tecnología | Uso |
|---|---|
| **Go 1.22** | Daemon de polling de alto rendimiento |
| **gosnmp** | SNMP MIB-II polling a switches |
| **ONVIF** | Probe de cámaras IP (GetDeviceInformation) |
| **net/icmp** | Ping Level 1 a todos los dispositivos |

### Infraestructura
| Servicio | Tecnología | Puerto |
|---|---|---|
| Base de datos | PostgreSQL 16 + PostGIS 3.4 | 5434 |
| Cache | Redis 7 | 6379 |
| Event bus | Redpanda (Kafka-compatible, sin JVM) | 9092 |
| Admin UI Redpanda | Redpanda Console | 8082 |
| Almacenamiento de objetos | MinIO (S3-compatible) | 9000 / 9001 (consola) |
| Observabilidad | Grafana OSS | 3005 |

---

## Capacidades de la plataforma

### Builder (Topología)
Interfaz CRUD para construir la jerarquía completa de red:

```
Ciudad
 └── Proyecto (cliente, contrato, fechas)
      └── Centro de Monitoreo - CMC
           └── Ruta (fibra / wireless / hybrid)
                ├── Nodo (switch, gabinete, amplificador, splitter)
                │    └── Cámara (IP, marca, modelo, resolución)
                ├── Equipos oficiales del CMC (switches, UPS, cámaras del propio centro)
                └── Tramo de fibra + empalmes (nodoA → nodoB + waypoints GPS)
```

### Roles y permisos
Cada usuario tiene un **rol** y, además, una lista de **permisos granulares** independiente del rol — así se puede dar acceso a un módulo puntual sin ascender a alguien a ADMIN.

| Rol | Acceso |
|---|---|
| SUPER_ADMIN | Acceso total, único que puede tocar roles/permisos de cuentas elevadas |
| ADMIN | Acceso operativo total (bypasea los permisos granulares, igual que SUPER_ADMIN) |
| SUPERVISOR / OPERATOR / TECHNICIAN / VIEWER | Acceso según los permisos concretos que se les asignen |

| Permiso | Habilita |
|---|---|
| `MANAGE_USERS` | Crear/editar usuarios (nunca puede auto-otorgarse SUPER_ADMIN/ADMIN) |
| `MANAGE_ORG` | Ciudades, proyectos, CMC, branding, backups/operación |
| `MANAGE_ROUTES` | Rutas y su documentación de fibra |
| `MANAGE_NODES` | Nodos, activos de nodo, analíticas |
| `MANAGE_FIBER` | Tramos, puntos y empalmes de fibra |
| `MANAGE_CAMERAS` | Alta/edición de cámaras |
| `CAMERA_PREVIEW` | Ver el stream en vivo de una cámara |
| `RUN_DISCOVERY` | Lanzar un escaneo de discovery (nodo o CMC) |
| `RESOLVE_DISCOVERY` | Confirmar/descartar equipos encontrados por discovery |
| `VIEW_TELEMETRY` | Ver paneles de telemetría de red |
| `REPORTS_VIEW` | Ver histórico y vista previa de informes oficiales |
| `REPORTS_EXPORT` | Descargar artefactos (PDF/CSV) de informes ya generados |
| `REPORTS_CLOSE_PERIOD` | Generar (cerrar) un informe oficial manualmente |
| `REPORTS_SCHEDULE` | Programar la generación automática de informes (semanal/mensual) |

El sidebar solo muestra a cada usuario los módulos de administración para los que realmente tiene permiso — no hace falta conocer la URL a mano.

### Discovery automático
Dos scanners independientes, ambos con fallback a datos simulados si no hay herramienta configurada (para no romper el entorno de desarrollo):

- **Por nodo** — usa [LAN-Orangutan](tools/LAN-Orangutan) (nmap/arp-scan) vía `apps/api/scripts/run_lan_orangutan_scan.py`. Hace un primer pase rápido (`nmap -sn`), complementa con la tabla ARP local (`ip neigh`) para hosts que ignoran el ping de descubrimiento, y hace una segunda pasada dirigida (`nmap -Pn`) solo a esos hosts silenciosos.
- **Por CMC** — mismo motor, correlaciona los hallazgos contra los equipos oficiales ya confirmados: los que aparecen en el escaneo pasan a `ONLINE` con `lastSeenAt` actualizado; los que llevan varios ciclos sin aparecer pasan a `OFFLINE` automáticamente (los estados `MAINTENANCE`/`DEGRADED`, al ser una decisión manual de un técnico, nunca se tocan). Puede correr bajo demanda ("Escanear ahora") o en un ciclo periódico opcional (`CENTER_MONITORING_INTERVAL_MS`).
- **Lookup de fabricante offline** — índice de ~54 000 prefijos MAC (`apps/api/scripts/data/mac_vendor_index.json`), sin depender de ningún servicio externo en tiempo de escaneo.
- Los hallazgos fuera del CIDR configurado del CMC se guardan aparte (`external-discovery`) en vez de descartarse.

### Telemetría de red
Un colector externo (autenticado con un token compartido) empuja snapshots periódicos de tráfico por nodo (`POST /network-telemetry/ingest`). La API deriva de ahí:
- Resumen y series de tiempo de bytes/hosts/flows por nodo
- Alertas automáticas (nodo silencioso, activo silencioso) con severidad
- Correlación entre hosts observados por telemetría y el inventario oficial/discovery

### Monitoreo en tiempo real (`apps/monitor`)
Daemon Go que pollea todos los dispositivos registrados:

| Nivel | Protocolo | Dispositivos | Intervalo |
|---|---|---|---|
| 1 | ICMP ping | Todos los nodos y cámaras con IP | 30 s |
| 2 | SNMP MIB-II | Nodos tipo SWITCH | 5 min |
| 3 | ONVIF GetDeviceInformation | Cámaras IP | 2 min |

- Solo reporta **cambios de estado** (online → offline y viceversa)
- Auto-llena marca y modelo de cámaras al primer probe ONVIF exitoso

### Heartbeat y alertas operacionales
Una segunda capa de verificación, integrada directamente en la API (no depende de que el daemon Go esté desplegado): un scheduler independiente hace ping a cada nodo, CMC y equipo con IP conocida en un ciclo configurable, y:

- Marca `ONLINE`/`OFFLINE` automáticamente tras superar un umbral de fallos consecutivos configurable (evita falsos positivos por un solo paquete perdido)
- Levanta y resuelve `OperationalAlert` por su cuenta — nadie tiene que crear el ticket a mano cuando un equipo deja de responder
- **Nunca toca** un equipo en `MAINTENANCE` o `DEGRADED` — esos estados son una decisión humana y la automatización los respeta siempre
- Sondea con concurrencia acotada (no secuencial), así que la detección no se degrada linealmente al crecer la flota de equipos

### Cámaras en vivo
Preview en vivo del stream RTSP de cualquier cámara desde el navegador, sin exponer la contraseña de la cámara al cliente: la API transcodifica con `ffmpeg` a MJPEG, la sesión expira a los 60 s, y la URL de origen debe coincidir con la IP configurada del nodo (evita apuntar el preview a cualquier host arbitrario).

### Observabilidad
Dashboards de Grafana embebidos por nodo y vista consolidada de red, servidos desde la propia UI (`/monitoring/network`).

### Branding institucional
Cada ciudad/entidad puede tener su propio logo y mensaje en la pantalla de login (`/admin/branding`), sirviendo el logo desde MinIO.

### Continuidad operativa
Desde `/admin/operations`, configuración de política de backups (automáticos, manuales protegidos) y del ciclo de actualizaciones del sistema, con trazabilidad completa de cada operación — qué se hizo, cuándo y con qué resultado. La ejecución de fondo de backup/restore se sigue reforzando activamente antes de habilitarla para operación sin supervisión.

### Informes oficiales (PDF / CSV)
Tres tipos de informe — **Monitoreo**, **Infraestructura** e **Incidentes** — con vista previa antes de cerrar el corte oficial:

- Vista previa instantánea con los mismos filtros del informe final (rango de fechas, ciudad, proyecto, CMC, nodo, severidad, estado)
- Al generar el corte oficial, el sistema emite PDF y CSV con el branding institucional activo, y lo deja en un histórico permanente (`REPORTS_CLOSE_PERIOD`)
- Programación automática semanal o mensual (`REPORTS_SCHEDULE`), o generación manual bajo demanda
- Cada informe generado queda trazado — tipo, rango, quién/qué lo disparó (manual o programado) y sus artefactos descargables (`REPORTS_VIEW` / `REPORTS_EXPORT`)
- Los archivos históricos viven en un bucket privado de MinIO separado del de branding público — solo son accesibles a través de un endpoint autorizado, nunca directamente desde el bucket

### Dashboard, mapa y bitácora
- **Dashboard**: resumen global online/offline/degradado por CMC, actualización instantánea vía WebSocket (rooms por CMC)
- **Mapa GIS**: marcadores por nodo coloreados por estado, polylines de fibra verdes/rojas según el estado de sus extremos
- **Incidentes**: creación manual, asignación a técnico, severidades LOW–CRITICAL, filtros por CMC/estado/severidad
- **Bitácora**: registro de actividades por nodo con trazabilidad de quién hizo qué y cuándo

---

## Módulos del sistema

Catálogo de referencia de cada módulo — qué hace y dónde vive.

### Backend (`apps/api/src`)

| Módulo | Qué hace |
|---|---|
| `auth` | Login, emisión de JWT, revalidación de sesión contra la base de datos en cada solicitud |
| `users` | Alta/edición de usuarios, roles y permisos granulares; protección contra auto-escalación de privilegios |
| `common` | Guards y decoradores compartidos (permisos, CORS, validación de entorno, construcción segura de comandos de discovery) |
| `cities` | Ciudades y departamentos — nivel más alto de la jerarquía geográfica |
| `projects` | Proyectos (cliente, contrato, fechas) dentro de una ciudad |
| `monitoring-centers` | Centros de Monitoreo (CMC): datos del centro, geocodificación automática |
| `center-assets` | Inventario oficial de equipos propios de un CMC (switches, UPS, cámaras del centro) |
| `center-discovery` | Discovery automático por CMC + reconciliación de estado (`ONLINE`/`OFFLINE`) contra el inventario oficial; incluye el scheduler de heartbeat del CMC y sus equipos |
| `external-discovery` | Hallazgos de discovery fuera del CIDR configurado, o traídos de otras fuentes (ej. ntopng), sin descartarlos |
| `routes` | Rutas de fibra/wireless/hybrid que conectan un CMC con sus nodos |
| `nodes` | Nodos de red (switch, gabinete, amplificador, splitter) |
| `node-assets` | Equipos asociados a un nodo específico |
| `node-analytics` | Catálogo de analíticas de video (LPR, reconocimiento facial, conteo, etc.) y su asignación a nodos/equipos |
| `node-discovery` | Discovery automático por nodo (mismo motor que `center-discovery`); incluye el scheduler de heartbeat del nodo y sus equipos |
| `heartbeat` | Probing de reachability compartido (ping con runner inyectable), concurrencia acotada y el servicio de alertas operacionales (`OperationalAlert`) que consumen ambos schedulers de heartbeat |
| `fiber-cables` / `fiber-points` / `fiber-segments` / `splices` | Documentación completa de la planta de fibra: cables troncales, puntos, tramos y empalmes |
| `cameras` | Alta/edición de cámaras IP, credenciales de stream cifradas |
| `camera-preview` | Sesión de preview en vivo (RTSP → MJPEG vía ffmpeg), expira sola a los 60 s |
| `network-telemetry` | Ingesta de snapshots de tráfico de un colector externo autenticado; deriva resúmenes, series de tiempo y alertas |
| `observability` | Resuelve las URLs de los dashboards de Grafana embebidos por nodo/red |
| `incidents` | Gestión de incidentes: severidad, asignación, resolución |
| `logbook` | Bitácora de actividades técnicas por nodo |
| `dashboard` | Resumen operativo agregado para la pantalla principal |
| `gateway` | Servidor WebSocket (socket.io) autenticado por JWT, distribuye cambios de estado por rooms de CMC |
| `events` | Productor Kafka/Redpanda — publica los cambios de estado que consume el `gateway` |
| `monitor` | Endpoint interno que recibe los reportes del daemon Go (`apps/monitor`) |
| `branding` | Perfiles de identidad institucional (logo, mensaje) por ciudad/entidad para la pantalla de login |
| `storage` | Integración con MinIO (S3): bucket público para logos/branding y bucket privado (sin acceso directo) para artefactos históricos de informes |
| `ops-lifecycle` | Política de backups, historial de respaldos/restauraciones/actualizaciones del sistema |
| `ops-reports` | Generación de informes oficiales (builders por tipo, render PDF/CSV, programación, histórico y branding del informe) |
| `data-retention` | Barrido diario que purga telemetría, snapshots de discovery y log de estados más viejos que la ventana de retención (90 días por defecto) — nunca toca incidentes, bitácora ni alertas |

### Frontend (`apps/web/app`)

| Ruta | Qué hace |
|---|---|
| `/login` | Acceso con branding institucional dinámico según la entidad activa |
| `/dashboard` | Resumen operativo global |
| `/map` | Mapa GIS interactivo de toda la red |
| `/topology` | Vista jerárquica CMC → rutas → nodos con estado en vivo |
| `/monitoring/network` | Monitor operativo por nodo: inventario correlacionado, discovery pendiente, telemetría y alertas |
| `/incidents` | Gestión de incidentes |
| `/logbook` | Bitácora de actividades técnicas |
| `/projects` | Gestión de proyectos |
| `/admin/cities` | Alta/edición de ciudades y departamentos |
| `/admin/branding` | Identidad institucional por ciudad/entidad |
| `/admin/centers` | CMC: datos, inventario oficial y discovery |
| `/admin/routes` | Rutas y su documentación completa de fibra óptica |
| `/admin/nodes` | Nodos, sus equipos, analíticas asignadas y discovery |
| `/admin/cameras` | Cámaras: alta/edición y preview en vivo |
| `/admin/users` | Usuarios, roles y permisos granulares |
| `/admin/operations` | Política de backups y ciclo de actualizaciones del sistema, agrupado en el sidebar junto a los informes oficiales |
| `/admin/operations/reports-monitoring` | Informe oficial de monitoreo: disponibilidad, alertas y comportamiento de red |
| `/admin/operations/reports-infrastructure` | Informe oficial de infraestructura: capacidad, distribución y composición física de la red |
| `/admin/operations/reports-incidents` | Informe oficial de incidentes: volumen, severidad, tiempos de resolución y tendencia |

---

## Arquitectura

```
┌──────────────────────────────── LAN Corporativa ─────────────────────────────┐
│                                                                               │
│   Switches ──┐                                                                │
│   Cámaras ───┤◄── apps/monitor (Go daemon)                                   │
│   Nodos ─────┘     ICMP / SNMP / ONVIF                                       │
│                         │                                                     │
│                    POST /internal/state-change                                │
│                         │                                                     │
│                    apps/api (NestJS :4001)                                    │
│                    ├── Prisma → PostgreSQL :5434                              │
│                    ├── Produce → Redpanda :9092                               │
│                    ├── Consume → WebSocket (socket.io, autenticado)           │
│                    ├── Discovery → LAN-Orangutan (nmap/arp-scan)              │
│                    ├── Telemetría → colector externo autenticado             │
│                    └── Storage → MinIO (branding/logos)                      │
│                         │                                                     │
│                    apps/web (Next.js :3001)                                   │
│                    ├── Builder UI                                              │
│                    ├── Dashboard en tiempo real                               │
│                    ├── Monitoreo de red + observabilidad (Grafana embed)      │
│                    └── Mapa GIS (MapLibre GL JS)                             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Flujo de un evento:**
1. Monitor detecta que un nodo pasó de ONLINE → OFFLINE
2. `POST /internal/state-change` al API
3. API persiste en BD + escribe en `siges.state-changes` (Redpanda)
4. API consume el evento y lo emite por WebSocket a la room `cmc:{id}`
5. Dashboard y mapa se actualizan en tiempo real para todos los operadores conectados

---

## Puertos

| Servicio | Puerto | Nota |
|---|---|---|
| apps/web | **3001** | Next.js dev server |
| apps/api | **4001** | NestJS REST + WebSocket |
| PostgreSQL | **5434** | No conflicta con LMS (5432) |
| Redis | **6379** | — |
| Redpanda Kafka | **9092** | — |
| Redpanda Console | **8082** | UI admin |
| MinIO | **9000** / **9001** | API S3 / consola admin |
| Grafana | **3005** | Observabilidad embebida |

> En producción, Postgres/Redis/Redpanda/consola de MinIO **no deben** exponerse fuera de la red interna — solo `web`, `api`, y si aplica Grafana/MinIO detrás de un reverse proxy con TLS.

---

## Arranque local

**1. Variables de entorno**
```bash
cp .env.example .env
# Como mínimo: JWT_SECRET, CAMERA_SECRET_KEY, MONITOR_API_TOKEN,
# NETWORK_TELEMETRY_INGEST_TOKEN, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
# El backend rechaza arrancar si quedan en el valor placeholder de .env.example.
```

**2. Dependencias del workspace**
```bash
npm install
```

**3. Infraestructura compartida**
```bash
docker compose up -d postgres redis redpanda minio grafana
```

**4. Base de datos**
```bash
npm run db:migrate   # aplica migraciones versionadas
npm run db:seed      # crea el primer SUPER_ADMIN con SEED_ADMIN_EMAIL/PASSWORD
```

**5. Desarrollo local (en terminales separadas)**
```bash
npm run dev --workspace=apps/api     # API en :4001
npm run dev --workspace=apps/web     # Web en :3001
cd apps/monitor && go run .          # Monitor daemon
```

**6. Discovery automático (opcional)**
Sin configurar nada, el discovery devuelve datos simulados (no rompe el flujo, pero no escanea de verdad). Para escaneo real: instalar `nmap` y/o `arp-scan`, y configurar `LAN_ORANGUTAN_HOME`/`LAN_ORANGUTAN_CMD` en `.env` (ver comentarios en `.env.example`).

**7. Stack completo en Docker**
```bash
docker compose up -d --build
```

Esto construye `apps/api` y `apps/web` desde el monorepo raíz usando el `package-lock.json` del workspace. La API arranca con `prisma migrate deploy` (no `db push`), así que no hay riesgo de pérdida de datos por drift de schema.

---

## Identidad visual

La interfaz sigue el **Manual de Imagen Corporativa SIGES-CCTV**:

| Token | Color | Uso |
|---|---|---|
| `ops-panel` | `#0A2540` | Azul Marino Institucional — paneles y sidebar |
| `ops-blue` | `#1D4ED8` | Azul Rey Tecnológico — acciones e interacción |
| `ops-silver` | `#94A3B8` | Gris Plata Operativo — texto secundario |
| `ops-rose` | `#f43f5e` | Alerta crítica / offline |
| `ops-amber` | `#f59e0b` | Advertencia / degradado |
| `ops-emerald` | `#10b981` | Online / operativo |

Tipografía: **Arial / Helvetica Neue** (títulos y UI), JetBrains Mono (datos técnicos).

---

## Mejora continua

La base ya está construida y en operación; esto es lo que suma en las próximas iteraciones:

- **Ejecución de fondo de backup/restore/actualización** — hoy la trazabilidad y la política ya existen en `ops-lifecycle`; sigue la orquestación automática de la operación misma
- **RTSP stream probe** — verificar que el stream de video de cada cámara responde, no solo que la cámara hace ping (Level 4)
- **Captura y clasificación de tráfico** — `apps/packet` en Rust con pcap
- **Analítica predictiva** — `apps/analytics` en Python, tendencias de disponibilidad y predicción de fallos
- **TLS end-to-end** para despliegues expuestos fuera de una red privada/VPN del cliente

---

## Design spec

Documento de diseño completo:
[`docs/superpowers/specs/2026-06-25-siges-cctv-design.md`](docs/superpowers/specs/2026-06-25-siges-cctv-design.md)
