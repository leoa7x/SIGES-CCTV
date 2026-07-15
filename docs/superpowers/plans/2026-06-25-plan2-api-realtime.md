# SIGES-CCTV Plan 2: API Real-time (FiberSegments + Monitor + WebSocket + Redpanda)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar los módulos que completan el API: FiberSegments CRUD, endpoints internos del monitor, integración KafkaJS con Redpanda, y WebSocket gateway para actualizar el frontend en tiempo real.

**Architecture:** El monitor Go llama `POST /internal/state-change`. El API persiste el cambio, publica un evento en Redpanda (topic `siges.state-changes`). Un consumer KafkaJS dentro del mismo proceso recibe el evento y lo emite por socket.io a la room `cmc:{centerId}`. El frontend escucha esa room y actualiza el estado sin recargar.

**Tech Stack:** NestJS 11, KafkaJS 2, @nestjs/websockets, socket.io 4, socket.io-client 4, MapLibre GL JS 5.

## Global Constraints

- Git author: `leoa7x` — verificar con `git config user.name` antes de cada commit
- Puertos: web=3001, api=4001, Redpanda=9092 — nunca 3000/4000/5432
- Token del monitor: `process.env.MONITOR_API_TOKEN` — nunca hardcodeado
- Topic Redpanda: `siges.state-changes` — nombre exacto, sin variaciones
- Room WebSocket: `cmc:{centerId}` — formato exacto
- Evento WebSocket emitido: `state-change` — nombre exacto
- Todos los comandos desde `/mnt/c/Users/ingel/SIGES-CCTV` salvo indicación

---

### Task 1: Instalar paquetes + corregir puerto web

**Files:**
- Modify: `apps/api/package.json` (vía npm install)
- Modify: `apps/web/package.json` (vía npm install + fix port)

**Interfaces:**
- Produces: paquetes kafkajs, @nestjs/websockets, @nestjs/platform-socket.io, socket.io disponibles en API; socket.io-client y maplibre-gl disponibles en web

- [ ] **Step 1: Instalar dependencias del API**

```bash
npm install kafkajs @nestjs/websockets @nestjs/platform-socket.io socket.io --workspace=apps/api --legacy-peer-deps
```

Verificar que aparecen en `apps/api/package.json` dependencies.

- [ ] **Step 2: Instalar dependencias de la web**

```bash
npm install socket.io-client maplibre-gl --workspace=apps/web --legacy-peer-deps
npm uninstall leaflet react-leaflet --workspace=apps/web --legacy-peer-deps
```

- [ ] **Step 3: Corregir puerto en web package.json**

En `apps/web/package.json`, cambiar el script `dev`:
```json
"dev": "next dev -p 3001"
```

- [ ] **Step 4: Verificar que el API compila con los nuevos paquetes**

```bash
npm run build --workspace=apps/api
```

Salida esperada: `Successfully compiled` sin errores.

- [ ] **Step 5: Commit**

```bash
git config user.name "leoa7x"
git add apps/api/package.json apps/web/package.json package-lock.json
git commit -m "chore: install kafkajs, websockets, socket.io, maplibre-gl; fix web port 3001"
```

---

### Task 2: Módulo FiberSegments

**Files:**
- Create: `apps/api/src/fiber-segments/fiber-segments.service.ts`
- Create: `apps/api/src/fiber-segments/fiber-segments.controller.ts`
- Create: `apps/api/src/fiber-segments/fiber-segments.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: PrismaService, FiberSegment/FiberState de @prisma/client (Task 1 de Plan 1)
- Produces: endpoints GET/POST/PATCH /fiber-segments

- [ ] **Step 1: Crear fiber-segments.service.ts**

Crear `apps/api/src/fiber-segments/fiber-segments.service.ts`:

```typescript
import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { FiberState } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateFiberSegmentDto {
  @IsString() @IsNotEmpty() nodeAId!: string;
  @IsString() @IsNotEmpty() nodeBId!: string;
  @IsOptional() waypoints?: number[][];
  @IsOptional() @IsNumber() lengthM?: number;
}

export class UpdateFiberSegmentDto {
  @IsOptional() waypoints?: number[][];
  @IsOptional() @IsEnum(FiberState) state?: FiberState;
  @IsOptional() @IsNumber() lengthM?: number;
}

@Injectable()
export class FiberSegmentsService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.fiberSegment.findMany({
      include: {
        nodeA: { select: { id: true, code: true, name: true, lat: true, lng: true } },
        nodeB: { select: { id: true, code: true, name: true, lat: true, lng: true } },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.fiberSegment.findUniqueOrThrow({
      where: { id },
      include: {
        nodeA: true,
        nodeB: true,
      },
    });
  }

  create(dto: CreateFiberSegmentDto) {
    const { nodeAId, nodeBId, waypoints, lengthM } = dto;
    return this.prisma.fiberSegment.create({
      data: {
        nodeA: { connect: { id: nodeAId } },
        nodeB: { connect: { id: nodeBId } },
        waypoints: waypoints ?? [],
        lengthM,
      },
      include: {
        nodeA: { select: { id: true, code: true, name: true } },
        nodeB: { select: { id: true, code: true, name: true } },
      },
    });
  }

  update(id: string, dto: UpdateFiberSegmentDto) {
    return this.prisma.fiberSegment.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.fiberSegment.update>[0]["data"],
    });
  }

  remove(id: string) {
    return this.prisma.fiberSegment.delete({ where: { id } });
  }
}
```

- [ ] **Step 2: Crear fiber-segments.controller.ts**

Crear `apps/api/src/fiber-segments/fiber-segments.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FiberSegmentsService, CreateFiberSegmentDto, UpdateFiberSegmentDto } from "./fiber-segments.service";

@UseGuards(AuthGuard("jwt"))
@Controller("fiber-segments")
export class FiberSegmentsController {
  constructor(private service: FiberSegmentsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateFiberSegmentDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberSegmentDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}
```

- [ ] **Step 3: Crear fiber-segments.module.ts**

Crear `apps/api/src/fiber-segments/fiber-segments.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { FiberSegmentsController } from "./fiber-segments.controller";
import { FiberSegmentsService } from "./fiber-segments.service";

@Module({
  controllers: [FiberSegmentsController],
  providers: [FiberSegmentsService],
})
export class FiberSegmentsModule {}
```

- [ ] **Step 4: Registrar en app.module.ts**

En `apps/api/src/app.module.ts`, agregar al principio del bloque de imports:

```typescript
import { FiberSegmentsModule } from "./fiber-segments/fiber-segments.module";
```

Y agregar `FiberSegmentsModule` al array `imports` del decorador `@Module`.

- [ ] **Step 5: Build para verificar**

```bash
npm run build --workspace=apps/api
```

Salida esperada: `Successfully compiled` sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/fiber-segments/ apps/api/src/app.module.ts
git commit -m "feat(api): add FiberSegments CRUD module"
```

---

### Task 3: Módulo Events (KafkaJS producer)

**Files:**
- Create: `apps/api/src/events/events.service.ts`
- Create: `apps/api/src/events/events.module.ts`

**Interfaces:**
- Produces: `EventsService.publish(topic: string, payload: object): Promise<void>`

- [ ] **Step 1: Crear events.service.ts**

Crear `apps/api/src/events/events.service.ts`:

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, Producer } from "kafkajs";

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private producer: Producer;

  constructor() {
    const kafka = new Kafka({
      clientId: "siges-api",
      brokers: (process.env.REDPANDA_BROKERS ?? "localhost:9092").split(","),
    });
    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
    this.logger.log("Kafka producer connected");
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  async publish(topic: string, payload: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}
```

- [ ] **Step 2: Crear events.module.ts**

Crear `apps/api/src/events/events.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";

@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
```

- [ ] **Step 3: Build**

```bash
npm run build --workspace=apps/api
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/events/
git commit -m "feat(api): add EventsService KafkaJS producer"
```

---

### Task 4: Módulo Monitor (endpoints internos)

**Files:**
- Create: `apps/api/src/monitor/monitor.guard.ts`
- Create: `apps/api/src/monitor/monitor.service.ts`
- Create: `apps/api/src/monitor/monitor.controller.ts`
- Create: `apps/api/src/monitor/monitor.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `EventsService.publish()` (Task 3), PrismaService
- Produces:
  - `POST /internal/state-change` — actualiza BD, publica a Redpanda
  - `GET /internal/devices` — lista nodos+cámaras con IP para el monitor Go

- [ ] **Step 1: Crear monitor.guard.ts**

Crear `apps/api/src/monitor/monitor.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class MonitorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const auth = req.headers["authorization"] ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const expected = process.env.MONITOR_API_TOKEN ?? "";
    if (!expected || token !== expected) throw new UnauthorizedException();
    return true;
  }
}
```

- [ ] **Step 2: Crear monitor.service.ts**

Crear `apps/api/src/monitor/monitor.service.ts`:

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";

export class StateChangeDto {
  @IsString() @IsNotEmpty() entityType!: "node" | "camera";
  @IsString() @IsNotEmpty() entityId!: string;
  @IsString() @IsNotEmpty() oldState!: string;
  @IsString() @IsNotEmpty() newState!: string;
}

@Injectable()
export class MonitorService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async handleStateChange(dto: StateChangeDto) {
    const { entityType, entityId, oldState, newState } = dto;
    let centerId: string;

    if (entityType === "node") {
      const node = await this.prisma.node.findUnique({
        where: { id: entityId },
        include: { route: { include: { center: true } } },
      });
      if (!node) throw new NotFoundException(`Node ${entityId} not found`);
      centerId = node.route.center.id;
      await this.prisma.node.update({
        where: { id: entityId },
        data: { operativeState: newState as Parameters<typeof this.prisma.node.update>[0]["data"]["operativeState"] },
      });
    } else {
      const camera = await this.prisma.camera.findUnique({
        where: { id: entityId },
        include: { node: { include: { route: { include: { center: true } } } } },
      });
      if (!camera) throw new NotFoundException(`Camera ${entityId} not found`);
      centerId = camera.node.route.center.id;
      await this.prisma.camera.update({
        where: { id: entityId },
        data: { state: newState as Parameters<typeof this.prisma.camera.update>[0]["data"]["state"] },
      });
    }

    await this.prisma.deviceStateLog.create({
      data: { entityType, entityId, oldState, newState, source: "MONITOR" },
    });

    await this.events.publish("siges.state-changes", {
      entityType,
      entityId,
      oldState,
      newState,
      centerId,
      timestamp: new Date().toISOString(),
    });

    return { ok: true };
  }

  async getDevices() {
    const [nodes, cameras] = await Promise.all([
      this.prisma.node.findMany({
        where: { ip: { not: null } },
        include: { route: { include: { center: true } } },
        select: {
          id: true,
          ip: true,
          mac: true,
          nodeType: true,
          snmpCommunity: true,
          operativeState: true,
          route: { select: { center: { select: { id: true } } } },
        },
      }),
      this.prisma.camera.findMany({
        where: { ip: { not: null } },
        include: { node: { include: { route: { include: { center: true } } } } },
        select: {
          id: true,
          ip: true,
          state: true,
          node: { select: { route: { select: { center: { select: { id: true } } } } } },
        },
      }),
    ]);

    return [
      ...nodes.map((n) => ({
        id: n.id,
        type: "node" as const,
        ip: n.ip,
        mac: n.mac,
        nodeType: n.nodeType,
        snmpCommunity: n.snmpCommunity,
        state: n.operativeState,
        centerId: n.route.center.id,
      })),
      ...cameras.map((c) => ({
        id: c.id,
        type: "camera" as const,
        ip: c.ip,
        state: c.state,
        centerId: c.node.route.center.id,
      })),
    ];
  }
}
```

- [ ] **Step 3: Crear monitor.controller.ts**

Crear `apps/api/src/monitor/monitor.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { MonitorGuard } from "./monitor.guard";
import { MonitorService, StateChangeDto } from "./monitor.service";

@UseGuards(MonitorGuard)
@Controller("internal")
export class MonitorController {
  constructor(private service: MonitorService) {}

  @Post("state-change")
  stateChange(@Body() dto: StateChangeDto) {
    return this.service.handleStateChange(dto);
  }

  @Get("devices")
  getDevices() {
    return this.service.getDevices();
  }
}
```

- [ ] **Step 4: Crear monitor.module.ts**

Crear `apps/api/src/monitor/monitor.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { MonitorController } from "./monitor.controller";
import { MonitorService } from "./monitor.service";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
```

- [ ] **Step 5: Registrar en app.module.ts**

Agregar imports en `apps/api/src/app.module.ts`:

```typescript
import { EventsModule } from "./events/events.module";
import { MonitorModule } from "./monitor/monitor.module";
```

Y agregar `EventsModule, MonitorModule` al array `imports`.

- [ ] **Step 6: Build**

```bash
npm run build --workspace=apps/api
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/monitor/ apps/api/src/app.module.ts
git commit -m "feat(api): add Monitor internal endpoints + MonitorGuard"
```

---

### Task 5: WebSocket Gateway (consumer Redpanda + socket.io)

**Files:**
- Create: `apps/api/src/gateway/ops.gateway.ts`
- Create: `apps/api/src/gateway/gateway.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: topic `siges.state-changes` de Redpanda
- Produces:
  - WebSocket en el mismo puerto 4001 (via `@nestjs/platform-socket.io`)
  - Cliente emite `{ event: 'subscribe', data: { centerId } }` → se une a room `cmc:{centerId}`
  - Servidor emite `state-change` con payload `{ entityType, entityId, oldState, newState, centerId, timestamp }`

- [ ] **Step 1: Crear ops.gateway.ts**

Crear `apps/api/src/gateway/ops.gateway.ts`:

```typescript
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { Kafka, Consumer } from "kafkajs";

interface StateChangePayload {
  entityType: string;
  entityId: string;
  oldState: string;
  newState: string;
  centerId: string;
  timestamp: string;
}

@Injectable()
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? "http://localhost:3001" } })
export class OpsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(OpsGateway.name);
  private consumer: Consumer;

  constructor() {
    const kafka = new Kafka({
      clientId: "siges-gateway",
      brokers: (process.env.REDPANDA_BROKERS ?? "localhost:9092").split(","),
    });
    this.consumer = kafka.consumer({ groupId: "siges-gateway-group" });
  }

  async onModuleInit() {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: "siges.state-changes", fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString()) as StateChangePayload;
        this.server.to(`cmc:${payload.centerId}`).emit("state-change", payload);
      },
    });
    this.logger.log("Kafka consumer connected — listening on siges.state-changes");
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: Socket, data: { centerId: string }) {
    const room = `cmc:${data.centerId}`;
    void client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { event: "subscribed", data: { room } };
  }
}
```

- [ ] **Step 2: Crear gateway.module.ts**

Crear `apps/api/src/gateway/gateway.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { OpsGateway } from "./ops.gateway";

@Module({
  providers: [OpsGateway],
})
export class GatewayModule {}
```

- [ ] **Step 3: Habilitar socket.io en main.ts**

En `apps/api/src/main.ts`, agregar después de `NestFactory.create`:

```typescript
import { IoAdapter } from "@nestjs/platform-socket.io";
```

Y después de `app.enableCors(...)`:

```typescript
app.useWebSocketAdapter(new IoAdapter(app));
```

- [ ] **Step 4: Registrar GatewayModule en app.module.ts**

Agregar import:
```typescript
import { GatewayModule } from "./gateway/gateway.module";
```
Y agregar `GatewayModule` al array `imports`.

- [ ] **Step 5: Build**

```bash
npm run build --workspace=apps/api
```

Salida esperada: sin errores TS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/gateway/ apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat(api): add WebSocket gateway + Redpanda consumer (siges.state-changes)"
```

---

### Task 6: Hook WebSocket en web + smoke test

**Files:**
- Create: `apps/web/lib/socket.ts`
- Create: `apps/web/hooks/use-monitor.ts`

**Interfaces:**
- Produces:
  - `getSocket(): Socket` — singleton socket.io-client conectado a API
  - `useMonitor(centerId: string)` — hook React que escucha eventos `state-change` del CMC dado

- [ ] **Step 1: Crear apps/web/lib/socket.ts**

```typescript
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001", {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
}
```

- [ ] **Step 2: Crear apps/web/hooks/use-monitor.ts**

```typescript
"use client";

import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";

export interface StateChangeEvent {
  entityType: "node" | "camera";
  entityId: string;
  oldState: string;
  newState: string;
  centerId: string;
  timestamp: string;
}

export function useMonitor(centerId: string | null) {
  const [lastEvent, setLastEvent] = useState<StateChangeEvent | null>(null);

  useEffect(() => {
    if (!centerId) return;
    const socket = getSocket();
    socket.emit("subscribe", { centerId });
    socket.on("state-change", (evt: StateChangeEvent) => {
      if (evt.centerId === centerId) setLastEvent(evt);
    });
    return () => {
      socket.off("state-change");
    };
  }, [centerId]);

  return lastEvent;
}
```

- [ ] **Step 3: Verificar que el API arranca sin errores**

Asegurarse de que Redpanda está corriendo:
```bash
docker compose ps
```

Iniciar el API:
```bash
npm run dev --workspace=apps/api 2>&1 | head -30
```

Salida esperada (entre las primeras líneas):
```
SIGES-CCTV API running on port 4001
Kafka producer connected
Kafka consumer connected — listening on siges.state-changes
```

- [ ] **Step 4: Smoke test — endpoint /internal/devices**

```bash
# Obtener token primero
TOKEN=$(curl -s -X POST http://localhost:4001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<admin-email>","password":"<admin-password>"}' | jq -r .accessToken)

# Test internal endpoint con MONITOR_API_TOKEN de .env
MONITOR_TOKEN=$(grep MONITOR_API_TOKEN /mnt/c/Users/ingel/SIGES-CCTV/.env 2>/dev/null | cut -d= -f2 || echo "test-monitor-token")

curl -s http://localhost:4001/internal/devices \
  -H "Authorization: Bearer $MONITOR_TOKEN" | jq 'length'
```

Salida esperada: `0` (sin dispositivos aún — BD vacía de nodos con IP).

- [ ] **Step 5: Smoke test — endpoint /fiber-segments**

```bash
curl -s http://localhost:4001/fiber-segments \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
```

Salida esperada: `0` (sin tramos aún).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/socket.ts apps/web/hooks/
git commit -m "feat(web): add socket.io-client hook useMonitor for real-time state"
```

---

### Task 7: Push final

- [ ] **Step 1: Verificar commits pendientes**

```bash
git log --oneline origin/main..HEAD
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

- [ ] **Step 3: Actualizar .env.example con MONITOR_API_TOKEN**

Si `MONITOR_API_TOKEN` no está en `.env.example`, agregar:
```
MONITOR_API_TOKEN=change_me_in_production
```

```bash
git add .env.example
git commit -m "docs: add MONITOR_API_TOKEN to .env.example"
git push origin main
```
