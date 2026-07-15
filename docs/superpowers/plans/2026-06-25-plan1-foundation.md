# SIGES-CCTV Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actualizar el schema de Prisma con los modelos completos, reemplazar RabbitMQ por Redpanda en docker-compose, corregir referencias de puertos y colores de marca en todo el codebase.

**Architecture:** Los cambios son transversales (schema, infra, config) y no agregan lógica de negocio. Producen un API que compila y arranca, con la BD correctamente actualizada y la UI usando los colores oficiales del manual de imagen.

**Tech Stack:** Prisma 6, Docker Compose, NestJS 11, Next.js 14, TypeScript.

## Global Constraints

- Git author: `leoa7x` — verificar con `git config user.name` antes de cada commit
- Puertos: web=3001, api=4001, postgres=5434 — nunca usar 3000/4000/5432 (conflicto con LMS)
- Color primario oficial: `ops-blue` (#1D4ED8) — no `ops-cyan` (eliminado del design system)
- Todos los comandos se ejecutan desde `/mnt/c/Users/ingel/SIGES-CCTV` salvo indicación
- Node workspaces: usar `--workspace=apps/api` y `--workspace=apps/web`

---

### Task 1: Actualizar schema Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: modelos `FiberSegment`, `DeviceStateLog`; enums `NodeType`, `FiberState`, `LogSource`; campos nuevos en `Node`

- [ ] **Step 1: Agregar campos a Node y el enum NodeType**

En `apps/api/prisma/schema.prisma`, reemplazar el bloque del modelo `Node` y agregar el enum `NodeType`:

```prisma
model Node {
  id             String         @id @default(uuid())
  code           String         @unique
  name           String
  lat            Float
  lng            Float
  address        String?
  ip             String?
  mac            String?
  nodeType       NodeType       @default(OTHER)
  snmpCommunity  String?
  operativeState NodeState      @default(ONLINE)
  routeId        String
  route          Route          @relation(fields: [routeId], references: [id])
  cameras        Camera[]
  fiberSegmentsA FiberSegment[] @relation("NodeA")
  fiberSegmentsB FiberSegment[] @relation("NodeB")
  logbookEntries LogbookEntry[]
  incidents      Incident[]     @relation("NodeIncidents")
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

enum NodeType {
  SWITCH
  CABINET
  AMPLIFIER
  SPLITTER
  OTHER
}
```

- [ ] **Step 2: Agregar modelo FiberSegment y enum FiberState**

Añadir después de la sección `// ─── Network topology`:

```prisma
model FiberSegment {
  id        String     @id @default(uuid())
  nodeAId   String
  nodeA     Node       @relation("NodeA", fields: [nodeAId], references: [id])
  nodeBId   String
  nodeB     Node       @relation("NodeB", fields: [nodeBId], references: [id])
  waypoints Json       @default("[]")
  state     FiberState @default(ACTIVE)
  lengthM   Float?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

enum FiberState {
  ACTIVE
  CUT
  DEGRADED
  MAINTENANCE
}
```

- [ ] **Step 3: Agregar modelo DeviceStateLog y enum LogSource**

Añadir antes de `// ─── Shared enums`:

```prisma
// ─── Monitor audit ────────────────────────────────────────────────────────────

model DeviceStateLog {
  id         String    @id @default(uuid())
  entityType String
  entityId   String
  oldState   String
  newState   String
  source     LogSource @default(MONITOR)
  createdAt  DateTime  @default(now())
}

enum LogSource {
  MONITOR
  MANUAL
}
```

- [ ] **Step 4: Aplicar schema a la BD**

```bash
npm run db:push --workspace=apps/api
```

Salida esperada: `Your database is now in sync with your Prisma schema. 🚀`

- [ ] **Step 5: Regenerar Prisma Client**

```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

- [ ] **Step 6: Commit**

```bash
git config user.name "leoa7x"
git add apps/api/prisma/schema.prisma
git commit -m "feat(schema): add NodeType, FiberSegment, DeviceStateLog models"
```

---

### Task 2: Reemplazar RabbitMQ con Redpanda en docker-compose

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: servicio `redpanda` en puertos 9092 (Kafka) y 8082 (console)

- [ ] **Step 1: Reemplazar el servicio rabbitmq por redpanda**

En `docker-compose.yml`, eliminar el bloque del servicio `rabbitmq` y su volumen `rabbitmq_data`, y agregar:

```yaml
  # ── Redpanda (Kafka-compatible) ──────────────────────────────────────────────
  redpanda:
    image: redpandadata/redpanda:latest
    container_name: siges-redpanda
    restart: unless-stopped
    command:
      - redpanda
      - start
      - --kafka-addr=0.0.0.0:9092
      - --advertise-kafka-addr=localhost:9092
      - --pandaproxy-addr=0.0.0.0:8082
      - --advertise-pandaproxy-addr=localhost:8082
      - --mode=dev-container
      - --smp=1
      - --default-log-level=warn
    volumes:
      - redpanda_data:/var/lib/redpanda/data
    ports:
      - "9092:9092"
      - "8082:8082"
    healthcheck:
      test: ["CMD-SHELL", "rpk cluster health | grep -E 'Healthy:.+true' || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 5
```

- [ ] **Step 2: Actualizar volúmenes — reemplazar rabbitmq_data por redpanda_data**

En la sección `volumes:` al final del archivo, reemplazar `rabbitmq_data:` por `redpanda_data:`.

- [ ] **Step 3: Eliminar referencias a rabbitmq en los servicios api y web**

En el servicio `api`, eliminar la línea:
```yaml
      RABBITMQ_URL: amqp://${RABBITMQ_USER:-siges}:${RABBITMQ_PASSWORD:-siges_pass_change_me}@rabbitmq:5672
```
Y en `depends_on`, eliminar la condición de `rabbitmq`.

- [ ] **Step 4: Reiniciar infraestructura**

```bash
docker compose down
docker compose up -d postgres redis redpanda
docker compose ps
```

Esperar a que los 3 servicios estén `healthy`.

- [ ] **Step 5: Actualizar .env.example**

En `.env.example`, reemplazar las líneas de RabbitMQ:
```
RABBITMQ_USER=siges
RABBITMQ_PASSWORD=siges_pass_change_me
RABBITMQ_PORT=5672
RABBITMQ_URL=amqp://siges:siges_pass_change_me@localhost:5672
```
Por:
```
REDPANDA_BROKERS=localhost:9092
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "infra: replace RabbitMQ with Redpanda (Kafka-compatible)"
```

---

### Task 3: Corregir referencias de puertos en API y Web

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/package.json` (si existe NEXT_PUBLIC_API_URL hardcodeado)

**Interfaces:**
- Produces: API escucha en 4001, web apunta a 4001

- [ ] **Step 1: Corregir main.ts — CORS origin y puerto por defecto**

En `apps/api/src/main.ts`, reemplazar las líneas:

```typescript
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });
```
```typescript
  const port = process.env.API_PORT ?? 4000;
```

Por:

```typescript
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3001",
    credentials: true,
  });
```
```typescript
  const port = process.env.API_PORT ?? 4001;
```

- [ ] **Step 2: Corregir lib/api.ts — URL por defecto**

En `apps/web/lib/api.ts`, reemplazar la primera línea:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
```

Por:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";
```

- [ ] **Step 3: Verificar que el API compila con los cambios**

```bash
npm run build --workspace=apps/api
```

Salida esperada: `Successfully compiled` sin errores TS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.ts apps/web/lib/api.ts
git commit -m "fix: correct default ports — api=4001 web points to 4001"
```

---

### Task 4: Reemplazar ops-cyan por ops-blue en toda la web

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/incidents/page.tsx`
- Modify: `apps/web/app/logbook/page.tsx`
- Modify: `apps/web/app/map/page.tsx`
- Modify: `apps/web/app/projects/page.tsx`

**Interfaces:**
- Produces: UI usa colores oficiales del Manual de Imagen Corporativa

- [ ] **Step 1: Reemplazar en todos los archivos tsx**

Ejecutar desde la raíz del repo:

```bash
find apps/web -name "*.tsx" | xargs sed -i \
  -e 's/ops-cyan-dim/ops-blue-dim/g' \
  -e 's/ops-cyan/ops-blue/g'
```

- [ ] **Step 2: Verificar que no quedan referencias a ops-cyan**

```bash
grep -rn "ops-cyan" apps/web --include="*.tsx" --include="*.ts"
```

Salida esperada: sin resultados.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/
git commit -m "style: replace ops-cyan with ops-blue across web (brand alignment)"
```

---

### Task 5: Actualizar NodesService con los campos nuevos del schema

**Files:**
- Modify: `apps/api/src/nodes/nodes.service.ts`

**Interfaces:**
- Consumes: `NodeType` enum de `@prisma/client`
- Produces: `CreateNodeDto` y `UpdateNodeDto` con campos `ip`, `mac`, `nodeType`, `snmpCommunity`

- [ ] **Step 1: Actualizar el import y los DTOs**

En `apps/api/src/nodes/nodes.service.ts`, reemplazar el bloque completo de imports y DTOs:

```typescript
import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { NodeState, NodeType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateNodeDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsEnum(NodeType) nodeType?: NodeType;
  @IsOptional() @IsString() snmpCommunity?: string;
  @IsString() @IsNotEmpty() routeId!: string;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsEnum(NodeType) nodeType?: NodeType;
  @IsOptional() @IsString() snmpCommunity?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
}
```

- [ ] **Step 2: Verificar que el API compila**

```bash
npm run build --workspace=apps/api
```

Salida esperada: `Successfully compiled` sin errores TS.

- [ ] **Step 3: Verificar que el API arranca**

```bash
npm run dev --workspace=apps/api 2>&1 | head -20
```

Salida esperada: `SIGES-CCTV API running on port 4001`

- [ ] **Step 4: Smoke test del endpoint de login**

```bash
curl -s -X POST http://localhost:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin-email>","password":"<admin-password>"}' | jq .
```

Salida esperada:
```json
{
  "accessToken": "eyJ...",
  "user": { "id": "...", "email": "<admin-email>", "role": "SUPER_ADMIN" }
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/nodes/nodes.service.ts
git commit -m "feat(nodes): add ip, mac, nodeType, snmpCommunity fields to DTO"
```

---

### Task 6: Push final

- [ ] **Step 1: Push todo a main**

```bash
git push origin main
```

- [ ] **Step 2: Verificar en GitHub que los commits aparecen con autor leoa7x**

Abrir https://github.com/leoa7x/SIGES-CCTV y revisar los últimos commits.
