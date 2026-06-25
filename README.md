# SIGES-CCTV

Sistema Integral de Gestión Operacional CCTV — plataforma NOC/SOC para gestionar redes de vigilancia urbana a gran escala.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, MapLibre GL JS |
| API | NestJS 11, Prisma 6, socket.io |
| Monitor | Go 1.22 — ICMP / SNMP / ONVIF |
| Event bus | Redpanda (Kafka-compatible) |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 |

## Estructura

```
SIGES-CCTV/
├── apps/
│   ├── api/        ← NestJS REST API + WebSocket gateway
│   ├── web/        ← Next.js dashboard
│   └── monitor/    ← Go daemon de polling (ICMP/SNMP/ONVIF)
├── packages/       ← tipos y utilidades compartidas
├── docs/
│   └── superpowers/specs/  ← design docs
└── docker-compose.yml
```

## Puertos

| Servicio | Puerto |
|---|---|
| Web | 3001 |
| API | 4001 |
| PostgreSQL | 5434 |
| Redis | 6379 |
| Redpanda (Kafka) | 9092 |
| Redpanda UI | 8082 |

## Arranque local

**1. Variables de entorno**

```bash
cp .env.example .env
# editar .env con tus valores
```

**2. Infraestructura**

```bash
docker compose up -d
```

**3. Base de datos**

```bash
npm run db:push --workspace=apps/api
npm run db:seed --workspace=apps/api
```

Credenciales iniciales: `admin@sigescctv.co` / `Admin1234!`

**4. Apps**

```bash
npm run dev --workspace=apps/api     # :4001
npm run dev --workspace=apps/web     # :3001
cd apps/monitor && go run .          # daemon
```

## Jerarquía de datos

```
Ciudad → Proyecto → CMC → Ruta → Nodo → Cámara
                               └──────→ Tramo de fibra
```

Todo se construye desde el builder — no hay assets precargados.

## Niveles de monitoreo

| Nivel | Protocolo | Dispositivo |
|---|---|---|
| 1 | ICMP ping | Nodos y cámaras con IP |
| 2 | SNMP (MIB-II) | Switches |
| 3 | ONVIF | Cámaras IP |

## Roles

`SUPER_ADMIN` › `ADMIN` › `SUPERVISOR` › `OPERATOR` › `TECHNICIAN` › `VIEWER`

## Design spec

[`docs/superpowers/specs/2026-06-25-siges-cctv-design.md`](docs/superpowers/specs/2026-06-25-siges-cctv-design.md)
