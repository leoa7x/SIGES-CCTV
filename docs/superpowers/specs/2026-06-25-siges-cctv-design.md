# SIGES-CCTV — Design Spec
**Date:** 2026-06-25
**Status:** Approved

---

## 1. Vision

Sistema Integral de Gestión Operacional CCTV (SIGES-CCTV) es una plataforma NOC/SOC para gestionar redes de vigilancia urbana a gran escala. Permite a operadores construir la topología de red desde cero (builder), monitorear el estado de dispositivos en tiempo real (monitor), y gestionar incidentes y bitácora de actividades.

**Principio central:** Builder, no asset. Todo elemento de la red es creado por el operador — no hay assets precargados.

---

## 2. Alcance del MVP

### Incluido
- Builder completo: Ciudad → Proyecto → CMC → Ruta → Nodo → Cámara → Tramo de fibra
- Monitor central: ICMP (Level 1) + SNMP (Level 2) + ONVIF básico (Level 3)
- Dashboard en tiempo real vía WebSocket
- Mapa GIS con MapLibre GL JS
- Gestión de incidentes
- Bitácora de actividades
- Auth con JWT y RBAC (6 roles)

### Fase 2 (fuera del MVP)
- ARP scan / auto-discovery de dispositivos (LAN-Orangutan logic)
- RTSP stream probe Level 4
- pcap + clasificación de tráfico (Sniffnet/Rust → `apps/packet`)
- Analytics Python (`apps/analytics`)
- Agentes distribuidos por sitio (si se requiere operación offline por CMC)

---

## 3. Escala objetivo

- 100+ nodos por CMC
- 1000+ cámaras por CMC
- Múltiples CMCs en la misma LAN corporativa
- Una sola instancia central (control plane unificado)

---

## 4. Arquitectura

### Topología física

Todos los CMCs y el servidor central están en la misma LAN corporativa. El monitor Go corre en el servidor central y alcanza todos los dispositivos directamente — no se requieren agentes remotos en el MVP.

```
LAN Corporativa
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Switches ──┐                                           │
│  Cámaras ───┤◄── apps/monitor (Go daemon)              │
│  Nodos ─────┘     ICMP / SNMP / ONVIF                  │
│                        │ state-change events            │
│                    Redpanda (Kafka API)                  │
│                    topic: siges.state-changes            │
│                        │                               │
│                   apps/api (NestJS) ── PostgreSQL+PostGIS│
│                        │ WebSocket (socket.io)          │
│                   apps/web (Next.js)                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Flujo principal

1. Operador registra topología en el builder (web → API → BD)
2. Monitor lee dispositivos registrados de la BD al iniciar
3. Monitor pollea cada dispositivo según su nivel:
   - ICMP: cada 30s (todos los nodos/cámaras con IP)
   - SNMP: cada 5min (nodos con `nodeType = SWITCH`)
   - ONVIF: cada 2min (cámaras online)
4. Si el estado cambia → Monitor hace `POST /internal/state-change` al API
5. API persiste el cambio en BD + `DeviceStateLog` + publica en Redpanda
6. API consume el evento de Redpanda → emite por WebSocket a la room del CMC
7. Frontend actualiza dashboard y mapa en tiempo real

---

## 5. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, MapLibre GL JS, socket.io-client |
| API | NestJS 11, TypeScript, Prisma 6, socket.io |
| Monitor | Go 1.22, gosnmp, go2rtc/onvif, net/http |
| Event bus | Redpanda (Kafka-compatible, sin JVM) |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 |
| Cache | Redis 7 |
| ORM | Prisma 6 |
| Auth | JWT + Passport.js, RBAC |
| Mapa | MapLibre GL JS |
| Infra local | Docker Compose (solo infraestructura) |

---

## 6. Modelo de datos

### Jerarquía

```
City
 └── Project
      └── MonitoringCenter (CMC)
           └── Route (FIBER | WIRELESS | HYBRID)
                ├── Node (SWITCH | CABINET | AMPLIFIER | SPLITTER | OTHER)
                │    └── Camera
                └── FiberSegment (tramo entre dos nodos)

DeviceStateLog  — historial de cambios de estado de cualquier entidad
```

### Modelos nuevos / modificados respecto al schema inicial

**Node** — campos adicionales:
- `ip String?` — dirección IP para ICMP/SNMP polling
- `mac String?` — dirección MAC (auto-llenado por SNMP/ARP)
- `nodeType NodeType` — enum: SWITCH | CABINET | AMPLIFIER | SPLITTER | OTHER
- `snmpCommunity String?` — comunidad SNMP (si difiere del default del CMC)

**FiberSegment** — nuevo modelo:
```
id          String   @id @default(uuid())
nodeAId     String
nodeBId     String
waypoints   Json     // [[lat, lng], [lat, lng], ...]
state       FiberState  // ACTIVE | CUT | DEGRADED | MAINTENANCE
lengthM     Float?   // longitud en metros
```

**DeviceStateLog** — nuevo modelo (audit trail del monitor):
```
id          String   @id @default(uuid())
entityType  String   // "node" | "camera"
entityId    String
oldState    String
newState    String
source      LogSource  // MONITOR | MANUAL
createdAt   DateTime @default(now())
```

### Enums adicionales
- `NodeType`: SWITCH, CABINET, AMPLIFIER, SPLITTER, OTHER
- `FiberState`: ACTIVE, CUT, DEGRADED, MAINTENANCE
- `LogSource`: MONITOR, MANUAL

### Roles RBAC
| Rol | Permisos |
|---|---|
| SUPER_ADMIN | Todo |
| ADMIN | Gestión completa de topología e incidentes |
| SUPERVISOR | Ver todo, editar incidentes |
| OPERATOR | Dashboard, mapa, crear incidentes |
| TECHNICIAN | Bitácora, ver topología |
| VIEWER | Solo lectura |

---

## 7. apps/monitor — Monitor Go

### Estructura

```
apps/monitor/
├── main.go
├── config/        ← env vars: API_URL, API_TOKEN, poll intervals
├── poller/
│   ├── icmp.go    ← ping Level 1
│   ├── snmp.go    ← Level 2: sysDescr, ifTable, ifOperStatus (MIB-II)
│   └── onvif.go   ← Level 3: GetDeviceInformation, auto-fill brand/model
├── reporter/
│   └── http.go    ← POST /internal/state-change
└── store/
    └── state.go   ← mapa en memoria entityId → lastKnownState
```

### Lógica extraída de repos de referencia

**De NetAlertX:**
- SNMP OIDs: `sysDescr` (1.3.6.1.2.1.1.1.0), `ifOperStatus` (1.3.6.1.2.1.2.2.1.8), `ifDescr`
- Cambio de estado: comparar estado nuevo con `store/state.go` antes de reportar
- IEEE OUI offline: lookup MAC → vendor (base de datos bundleada en el binario)

**De VibeNVR:**
- ONVIF `GetDeviceInformation` → extrae Manufacturer, Model, FirmwareVersion, SerialNumber
- Al primer probe exitoso → `PATCH /topology/cameras/:id` para auto-llenar brand/model
- RTSP probe básico: conectar al stream RTSP, verificar que responde (Fase 2 completo)

### Carga inicial y refresh de dispositivos

Al arrancar, el monitor llama:
```
GET /internal/devices   ← devuelve todos los nodos y cámaras con IP registrada
```
Refresca esta lista cada 5 minutos para detectar nuevos dispositivos agregados via el builder.

### Ciclos de polling

```
Ticker 30s  → ICMP ping a todos los nodos/cámaras con IP definida
Ticker 300s → SNMP a todos los nodos con nodeType=SWITCH
Ticker 120s → ONVIF GetDeviceInformation a cámaras con IP y state=ONLINE
Ticker 300s → refresh lista de dispositivos desde API
```

Solo publica cuando `newState != store[entityId]`. Sin RabbitMQ/Redpanda directo — el monitor solo habla HTTP al API.

---

## 8. apps/api — API NestJS

### Módulos

```
src/
├── auth/          ← JWT login, JwtAuthGuard, RolesGuard, @Roles() decorator
├── users/         ← CRUD usuarios
├── topology/      ← cities, projects, centers, routes, nodes, cameras, fiber-segments
├── incidents/     ← CRUD incidentes, asignación a usuario
├── logbook/       ← entradas de bitácora por nodo
├── monitor/       ← POST /internal/state-change (token fijo, no JWT)
│                     persiste DeviceStateLog + publica a Redpanda
└── gateway/       ← WebSocket gateway socket.io
                      rooms: cmc:{centerId}
                      evento: 'state-change' { entityType, entityId, newState }
```

### Endpoints clave

```
POST   /auth/login                          ← { email, password } → { token }
GET    /topology/centers                    ← lista CMCs del usuario
GET    /topology/centers/:id/dashboard      ← resumen: online/offline por tipo
POST   /topology/nodes                      ← crear nodo (builder)
POST   /topology/fiber-segments             ← crear tramo de fibra
GET    /incidents?centerId=&status=         ← lista con filtros
POST   /incidents                           ← crear incidente
PATCH  /incidents/:id/assign                ← asignar a técnico
POST   /logbook                             ← nueva entrada
POST   /internal/state-change               ← solo Monitor (Bearer token fijo)
GET    /internal/devices                    ← solo Monitor, devuelve nodos+cámaras con IP
```

### Redpanda topics

| Topic | Productor | Consumidor |
|---|---|---|
| `siges.state-changes` | API (desde /internal/state-change) | WebSocket Gateway |
| `siges.incidents` | API (al crear/actualizar incidente CRITICAL) | Alertas (Fase 2) |

---

## 9. apps/web — Frontend Next.js

### Estructura de páginas

```
app/
├── (auth)/login/
└── (ops)/
    ├── dashboard/             ← resumen global por CMC
    ├── topology/
    │   ├── cities/            ← CRUD
    │   ├── projects/          ← CRUD
    │   ├── centers/           ← CRUD
    │   └── [centerId]/
    │       ├── routes/
    │       ├── nodes/         ← con IP, tipo, coordenadas
    │       ├── cameras/       ← con IP, brand/model (auto-fill de ONVIF)
    │       └── fiber/         ← tramos: seleccionar nodoA, nodoB, dibujar waypoints en mapa
    ├── map/                   ← MapLibre GL JS, marcadores + polylines
    ├── incidents/
    └── logbook/
```

### Tiempo real

```typescript
// hook por CMC
useWebSocket(centerId) {
  socket.join(`cmc:${centerId}`)
  socket.on('state-change', ({ entityType, entityId, newState }) => {
    // actualiza store local → re-render badge sin reload
  })
}
```

### Mapa GIS

- **Marcadores por nodo:** color según `operativeState`
  - emerald (#10b981) = ONLINE
  - rose (#f43f5e) = OFFLINE
  - amber (#f59e0b) = DEGRADED
  - ops-dim = MAINTENANCE
- **Polylines por FiberSegment:** verde si ambos nodos extremos ONLINE, rojo si alguno OFFLINE
- **Click en marcador:** panel lateral con detalle del nodo + lista de cámaras + último log

### Design system

Colores según Manual de Imagen Corporativa oficial:
- `ops-bg`: #061929 (fondo raíz)
- `ops-panel`: #0A2540 (Azul Marino Institucional — paneles)
- `ops-surface`: #0D2F55 (superficies elevadas)
- `ops-blue`: #1D4ED8 (Azul Rey Tecnológico — acento primario, botones)
- `ops-silver`: #94A3B8 (Gris Plata Operativo — texto secundario)
- `ops-amber`: #f59e0b (advertencias)
- `ops-rose`: #f43f5e (alertas críticas / offline)
- `ops-emerald`: #10b981 (online / ok)

Tipografía: Arial / Helvetica Neue (brand), Inter como fallback web.

Logo: escudo con lente óptica centrada — SVG inline en `components/ops-shell.tsx`.

---

## 10. Infraestructura

### Docker Compose — solo infraestructura

```yaml
services:
  postgres:
    image: postgis/postgis:16-3.4
    ports: ["5434:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  redpanda:
    image: redpandadata/redpanda:latest
    ports:
      - "9092:9092"   # Kafka protocol
      - "8082:8082"   # REST admin UI
    command: >
      redpanda start
      --kafka-addr 0.0.0.0:9092
      --advertise-kafka-addr localhost:9092
      --mode dev-container
```

### Puertos (sin conflicto con LMS en 3000/4000/5432)

| Servicio | Puerto |
|---|---|
| apps/web | 3001 |
| apps/api | 4001 |
| PostgreSQL | 5434 |
| Redis | 6379 |
| Redpanda Kafka | 9092 |
| Redpanda UI | 8082 |

### Variables de entorno

```env
DATABASE_URL=postgresql://siges:siges_pass@localhost:5434/siges_cctv
JWT_SECRET=<cambiar en producción>
REDPANDA_BROKERS=localhost:9092
MONITOR_API_URL=http://localhost:4001
MONITOR_API_TOKEN=<token fijo para /internal/state-change>
MONITOR_ICMP_INTERVAL=30
MONITOR_SNMP_INTERVAL=300
MONITOR_ONVIF_INTERVAL=120
```

### Secuencia de arranque

```bash
docker compose up -d                        # postgres + redis + redpanda
npm run db:push --workspace=apps/api        # aplica schema Prisma
SEED_ADMIN_EMAIL=admin@entidad.gov.co SEED_ADMIN_PASSWORD='<define-una-clave-segura>' npm run db:seed --workspace=apps/api
npm run dev --workspace=apps/api            # NestJS en :4001
cd apps/monitor && go run .                 # daemon de polling
npm run dev --workspace=apps/web            # Next.js en :3001
```

---

## 11. Seguridad

- JWT con expiración 8h, refresh manual (re-login)
- `/internal/state-change` protegido por Bearer token fijo (env var), no expuesto al exterior
- Passwords hasheados con bcrypt (cost 12)
- RBAC: guard verifica rol en cada endpoint protegido
- Sin dependencias de internet — todo offline/self-hosted

---

## 12. Repos de referencia

| Repo | Lógica extraída | Fase |
|---|---|---|
| VibeNVR | ONVIF GetDeviceInformation, auto-fill brand/model en Camera | MVP |
| NetAlertX | SNMP OIDs MIB-II, change detection, IEEE OUI MAC→vendor | MVP |
| LAN-Orangutan | ARP scan, device auto-discovery | Fase 2 |
| Sniffnet | pcap capture, traffic classification (apps/packet Rust) | Fase 2 |
| GeoLibre | MapLibre GL JS para mapa GIS | MVP |
