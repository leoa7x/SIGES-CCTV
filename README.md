<div align="center">
  <img src="docs/logo.svg" width="100" alt="SIGES-CCTV Logo" />
  <h1>SIGES-CCTV</h1>
  <p><strong>Sistema Integral de Gestión Operacional CCTV</strong></p>
  <p>Plataforma NOC/SOC para gestión y monitoreo de redes de vigilancia urbana a gran escala.</p>

  ![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)
  ![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs)
  ![Go](https://img.shields.io/badge/Go-1.22-00ADD8?style=flat-square&logo=go)
  ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+PostGIS-4169E1?style=flat-square&logo=postgresql)
  ![Redpanda](https://img.shields.io/badge/Redpanda-Kafka%20API-FF3333?style=flat-square)
</div>

---

## Qué es SIGES-CCTV

SIGES-CCTV es una plataforma operacional diseñada para centros de monitoreo que gestionan redes de vigilancia con cientos de nodos y miles de cámaras. El sistema permite:

- **Construir** la topología de red completa desde cero — ciudades, proyectos, CMCs, rutas, nodos, cámaras y tramos de fibra óptica
- **Monitorear** el estado de todos los dispositivos en tiempo real (ICMP, SNMP, ONVIF)
- **Visualizar** la red georreferenciada sobre un mapa GIS interactivo
- **Gestionar** incidentes, asignarlos a técnicos y llevar bitácora de actividades
- **Alertar** en tiempo real cuando un dispositivo cae o se degrada

> **Principio de diseño:** Builder, no asset. Todo elemento de la red es registrado por el operador — no hay configuraciones preexistentes.

---

## Stack tecnológico

### Frontend — `apps/web`
| Tecnología | Uso |
|---|---|
| **Next.js 14** (App Router) | Framework React, SSR + cliente |
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
| **socket.io** | Gateway WebSocket por rooms de CMC |
| **Redpanda (Kafka API)** | Consumo de eventos del monitor |
| **JWT + Passport.js** | Autenticación stateless |
| **RBAC** | Control de acceso por roles |
| **Swagger** | Documentación de API auto-generada |

### Monitor — `apps/monitor`
| Tecnología | Uso |
|---|---|
| **Go 1.22** | Daemon de polling de alto rendimiento |
| **gosnmp** | SNMP MIB-II polling a switches |
| **ONVIF** | Probe de cámaras IP (GetDeviceInformation) |
| **net/icmp** | Ping Level 1 a todos los dispositivos |
| **IEEE OUI DB** | Lookup MAC → vendor offline (bundleado) |

### Infraestructura
| Servicio | Tecnología | Puerto |
|---|---|---|
| Base de datos | PostgreSQL 16 + PostGIS 3.4 | 5434 |
| Cache | Redis 7 | 6379 |
| Event bus | Redpanda (Kafka-compatible, sin JVM) | 9092 |
| Admin UI | Redpanda Console | 8082 |

---

## Qué se está construyendo

### Fase 1 — MVP

#### Builder (Topología)
Interfaz CRUD para construir la jerarquía completa de red:

```
Ciudad
 └── Proyecto (cliente, contrato, fechas)
      └── Centro de Monitoreo - CMC
           └── Ruta (fibra / wireless / hybrid)
                ├── Nodo (switch, gabinete, amplificador, splitter)
                │    └── Cámara (IP, marca, modelo, resolución)
                └── Tramo de fibra (nodoA → nodoB + waypoints GPS)
```

#### Monitor (Polling automático)
Daemon Go que pollea todos los dispositivos registrados:

| Nivel | Protocolo | Dispositivos | Intervalo |
|---|---|---|---|
| 1 | ICMP ping | Todos los nodos y cámaras con IP | 30 s |
| 2 | SNMP MIB-II | Nodos tipo SWITCH | 5 min |
| 3 | ONVIF GetDeviceInformation | Cámaras IP | 2 min |

- Solo reporta **cambios de estado** (online → offline y viceversa)
- Auto-llena marca y modelo de cámaras al primer probe ONVIF exitoso
- Lookup MAC → vendor offline con base IEEE OUI bundleada

#### Dashboard en tiempo real
- Resumen global: conteo de dispositivos online/offline/degradados por CMC
- Actualización instantánea vía WebSocket — sin polling del navegador
- Rooms por CMC: cada cliente solo recibe eventos de sus centros

#### Mapa GIS
- Marcadores por nodo coloreados por estado operativo
- Polylines por tramo de fibra: verde si ambos extremos están online, rojo si alguno cae
- Click en marcador: panel lateral con detalle del nodo y sus cámaras
- Escala: 1000+ marcadores con rendimiento usando MapLibre GL JS

#### Gestión de incidentes
- Creación manual o automática al detectar caída
- Asignación a técnico, seguimiento de estado, registro de solución
- Severidades: LOW / MEDIUM / HIGH / CRITICAL
- Filtros por CMC, estado y severidad

#### Bitácora operacional
- Registro de actividades por nodo (mantenimiento preventivo, correctivo, inspección, instalación)
- Trazabilidad completa de quién hizo qué y cuándo

#### Roles y acceso
| Rol | Acceso |
|---|---|
| SUPER_ADMIN | Acceso total al sistema |
| ADMIN | Gestión completa de topología e incidentes |
| SUPERVISOR | Lectura total + edición de incidentes |
| OPERATOR | Dashboard, mapa, crear incidentes |
| TECHNICIAN | Bitácora + lectura de topología |
| VIEWER | Solo lectura |

---

### Fase 2 — Expansión

- **ARP scan y auto-discovery** — detectar dispositivos en la LAN automáticamente y sugerirlos al builder (lógica de LAN-Orangutan y NetAlertX)
- **RTSP stream probe** — verificar que el stream de video de cada cámara responde (Level 4)
- **Captura de tráfico** — `apps/packet` en Rust con pcap, clasificación de flujos (lógica de Sniffnet)
- **Analytics** — `apps/analytics` en Python, tendencias de disponibilidad, predicción de fallos

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
│                    └── Consume → WebSocket (socket.io)                        │
│                         │                                                     │
│                    apps/web (Next.js :3001)                                   │
│                    ├── Builder UI                                              │
│                    ├── Dashboard en tiempo real                               │
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

---

## Arranque local

**1. Variables de entorno**
```bash
cp .env.example .env
# editar valores de JWT_SECRET y MONITOR_API_TOKEN
```

**2. Dependencias del workspace**
```bash
npm install
```

**3. Infraestructura compartida**
```bash
docker compose up -d postgres redis redpanda minio
```

**4. Base de datos**
```bash
npm run db:push
npm run db:seed
```

Credenciales iniciales: `admin@sigescctv.co` / `Admin1234!`

**5. Desarrollo local (en terminales separadas)**
```bash
npm run dev --workspace=apps/api     # API en :4001
npm run dev --workspace=apps/web     # Web en :3001
cd apps/monitor && go run .          # Monitor daemon
```

**6. Stack completo en Docker**
```bash
docker compose up -d --build
```

Esto construye `apps/api` y `apps/web` desde el monorepo raíz usando el `package-lock.json` del workspace.

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

## Design spec

Documento de diseño completo:
[`docs/superpowers/specs/2026-06-25-siges-cctv-design.md`](docs/superpowers/specs/2026-06-25-siges-cctv-design.md)
