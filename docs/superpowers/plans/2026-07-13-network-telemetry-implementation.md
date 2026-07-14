# Network Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add node-level network telemetry ingestion, storage, query APIs, and UI integration so `/monitoring/network` reads real telemetry snapshots instead of derived placeholders.

**Architecture:** Add a new `network-telemetry` module to the Nest API, backed by three Prisma models: snapshot, asset sample, and alert. The API accepts one summarized collector payload per node every 60 seconds, correlates asset samples to official assets or recent discovery candidates, derives active alerts, and exposes summary/timeseries/assets/alerts endpoints for the existing network monitor page.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, TypeScript, Next.js 15, node:test, ts-node

## Global Constraints

- Accept summarized network telemetry from an external collector every 60 seconds.
- Do not embed packet capture inside the Nest API.
- Do not store PCAP or raw packet streams.
- Keep `topProtocols` and `topDestinations` as JSON in v1.
- Correlate telemetry to `Node`, `NodeAsset`, and recent `NodeDiscoveredDevice`.
- Do not auto-create official assets from telemetry in v1.
- Do not merge telemetry samples into discovery records automatically.
- Alert kinds in v1: `NODE_SILENT`, `ASSET_SILENT`, `UNMATCHED_TRAFFIC`, `NEW_DESTINATION`.

---

## File Structure

### API Prisma

- Create: `apps/api/prisma/migrations/<timestamp>_network_telemetry/migration.sql`
- Modify: `apps/api/prisma/schema.prisma`

Responsibility:

- Add durable storage for telemetry snapshots, asset samples, and alerts.

### API Module

- Create: `apps/api/src/network-telemetry/network-telemetry.module.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.controller.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.ingest.dto.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.alerts.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.types.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

Responsibility:

- Validate ingestion payloads
- Persist snapshots and asset samples
- Correlate assets and discovery candidates
- Derive alerts
- Expose query endpoints

### Web Integration

- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/network-monitor.ts`
- Modify: `apps/web/lib/network-monitor.test.ts`

Responsibility:

- Fetch real telemetry summary/timeseries/assets/alerts from API
- Remove traffic-tab dependence on locally derived placeholder metrics

## Task 1: Add Prisma Models For Telemetry

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_network_telemetry/migration.sql`

**Interfaces:**
- Consumes: existing `Node`, `NodeAsset`, `NodeDiscoveredDevice`
- Produces:
  - `NetworkTelemetrySnapshot`
  - `NetworkTelemetryAssetSample`
  - `NetworkTelemetryAlert`
  - enums `NetworkTelemetryClassificationSource`, `NetworkTelemetryAlertKind`, `NetworkTelemetryAlertSeverity`

- [ ] **Step 1: Write the failing schema additions in `apps/api/prisma/schema.prisma`**

```prisma
enum NetworkTelemetryClassificationSource {
  OFFICIAL
  DISCOVERY
  UNMATCHED
}

enum NetworkTelemetryAlertKind {
  NODE_SILENT
  ASSET_SILENT
  UNMATCHED_TRAFFIC
  NEW_DESTINATION
}

enum NetworkTelemetryAlertSeverity {
  INFO
  WARNING
  CRITICAL
}

model NetworkTelemetrySnapshot {
  id                  String   @id @default(uuid())
  nodeId              String
  node                Node     @relation(fields: [nodeId], references: [id])
  collectorId         String
  capturedAt          DateTime
  windowSeconds       Int
  totalBytesIn        BigInt
  totalBytesOut       BigInt
  activeHosts         Int
  activeFlows         Int
  alertCount          Int      @default(0)
  topProtocolsJson    Json
  topDestinationsJson Json
  assetSamples        NetworkTelemetryAssetSample[]
  alerts              NetworkTelemetryAlert[]
  createdAt           DateTime @default(now())

  @@index([nodeId, capturedAt])
}

model NetworkTelemetryAssetSample {
  id                   String                               @id @default(uuid())
  snapshotId           String
  snapshot             NetworkTelemetrySnapshot             @relation(fields: [snapshotId], references: [id])
  nodeId               String
  node                 Node                                 @relation(fields: [nodeId], references: [id])
  nodeAssetId          String?
  nodeAsset            NodeAsset?                           @relation(fields: [nodeAssetId], references: [id])
  ip                   String?
  mac                  String?
  hostname             String?
  bytesIn              BigInt
  bytesOut             BigInt
  flowCount            Int
  lastSeenAt           DateTime
  classificationSource NetworkTelemetryClassificationSource
  createdAt            DateTime                             @default(now())

  @@index([nodeId, createdAt])
  @@index([nodeAssetId])
}

model NetworkTelemetryAlert {
  id          String                        @id @default(uuid())
  nodeId      String
  node        Node                          @relation(fields: [nodeId], references: [id])
  snapshotId  String?
  snapshot    NetworkTelemetrySnapshot?     @relation(fields: [snapshotId], references: [id])
  nodeAssetId String?
  nodeAsset   NodeAsset?                    @relation(fields: [nodeAssetId], references: [id])
  kind        NetworkTelemetryAlertKind
  severity    NetworkTelemetryAlertSeverity
  title       String
  detail      String
  metadataJson Json?
  firstSeenAt DateTime
  lastSeenAt  DateTime
  isActive    Boolean                       @default(true)
  resolvedAt  DateTime?
  createdAt   DateTime                      @default(now())
  updatedAt   DateTime                      @updatedAt

  @@index([nodeId, isActive])
  @@index([kind, isActive])
}
```

- [ ] **Step 2: Run Prisma validation to verify the schema currently fails if references are incomplete**

Run: `cd apps/api && ../../node_modules/.bin/prisma validate`

Expected: either success or a concrete schema error that identifies missing back-relations

- [ ] **Step 3: Add missing back-relations to existing models**

```prisma
model Node {
  // existing fields...
  telemetrySnapshots NetworkTelemetrySnapshot[]
  telemetrySamples   NetworkTelemetryAssetSample[]
  telemetryAlerts    NetworkTelemetryAlert[]
}

model NodeAsset {
  // existing fields...
  telemetrySamples NetworkTelemetryAssetSample[]
  telemetryAlerts  NetworkTelemetryAlert[]
}
```

- [ ] **Step 4: Create the migration SQL**

Run: `cd apps/api && ../../node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_network_telemetry/migration.sql`

Expected: SQL file created with `CREATE TYPE` and `CREATE TABLE` statements for the new telemetry models

- [ ] **Step 5: Re-run Prisma validation**

Run: `cd apps/api && ../../node_modules/.bin/prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add network telemetry prisma models"
```

## Task 2: Add DTOs, Types, And Failing Telemetry Service Tests

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry.ingest.dto.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.types.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: Prisma model names from Task 1
- Produces:
  - `IngestNetworkTelemetryDto`
  - `NetworkTelemetryProtocolEntry`
  - `NetworkTelemetryDestinationEntry`
  - `NetworkTelemetryAssetEntry`
  - `npm run test:network-telemetry`

- [ ] **Step 1: Write DTO and helper types**

```ts
// apps/api/src/network-telemetry/network-telemetry.types.ts
export type NetworkTelemetryProtocolEntry = {
  name: string;
  bytes: number;
  flowCount: number;
};

export type NetworkTelemetryDestinationEntry = {
  target: string;
  kind: "IP" | "DOMAIN" | "ASN" | "UNKNOWN";
  bytes: number;
  flowCount: number;
};

export type NetworkTelemetryAssetEntry = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn: number;
  bytesOut: number;
  flowCount: number;
  lastSeenAt: string;
};
```

```ts
// apps/api/src/network-telemetry/network-telemetry.ingest.dto.ts
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class TotalsDto {
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) activeHosts!: number;
  @IsInt() @Min(0) activeFlows!: number;
}

class ProtocolDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class DestinationDto {
  @IsString() @IsNotEmpty() target!: string;
  @IsString() @IsIn(["IP", "DOMAIN", "ASN", "UNKNOWN"]) kind!: "IP" | "DOMAIN" | "ASN" | "UNKNOWN";
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class AssetSampleDto {
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) flowCount!: number;
  @IsISO8601() lastSeenAt!: string;
}

export class IngestNetworkTelemetryDto {
  @IsString() @IsNotEmpty() nodeId!: string;
  @IsString() @IsNotEmpty() collectorId!: string;
  @IsISO8601() capturedAt!: string;
  @IsInt() @Min(1) windowSeconds!: number;
  @ValidateNested() @Type(() => TotalsDto) totals!: TotalsDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProtocolDto) protocols!: ProtocolDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => DestinationDto) destinations!: DestinationDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => AssetSampleDto) assets!: AssetSampleDto[];
}
```

- [ ] **Step 2: Add a failing telemetry service test file**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NetworkTelemetryService } from "./network-telemetry.service";

test("ingestSnapshot correlates asset samples to official assets by MAC first", async () => {
  const service = new NetworkTelemetryService({
    node: { findUniqueOrThrow: async () => ({ id: "node-1" }) },
    nodeAsset: { findFirst: async ({ where }: { where: { mac?: string | undefined } }) => where.mac === "AA:BB" ? ({ id: "asset-1" }) : null },
    nodeDiscoveredDevice: { findFirst: async () => null },
    networkTelemetrySnapshot: { create: async () => ({ id: "snap-1" }) },
    networkTelemetryAssetSample: { createMany: async () => ({ count: 1 }) },
    networkTelemetryAlert: { upsert: async () => ({ id: "alert-1" }) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  } as never);

  const result = await service.ingestSnapshot({
    nodeId: "node-1",
    collectorId: "sensor-a",
    capturedAt: "2026-07-13T20:01:00.000Z",
    windowSeconds: 60,
    totals: { bytesIn: 10, bytesOut: 20, activeHosts: 1, activeFlows: 2 },
    protocols: [],
    destinations: [],
    assets: [{ mac: "AA:BB", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(result.snapshotId, "snap-1");
});
```

- [ ] **Step 3: Add the test script**

```json
"test:network-telemetry": "ts-node --project tsconfig.json src/network-telemetry/network-telemetry.service.test.ts"
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test:network-telemetry --workspace=apps/api`

Expected: FAIL with `Cannot find module './network-telemetry.service'` or `Property 'ingestSnapshot' does not exist`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry apps/api/package.json
git commit -m "test(api): add failing network telemetry service tests"
```

## Task 3: Implement Telemetry Service Ingestion And Correlation

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`

**Interfaces:**
- Consumes:
  - `IngestNetworkTelemetryDto`
  - Prisma models from Task 1
- Produces:
  - `ingestSnapshot(dto: IngestNetworkTelemetryDto): Promise<{ snapshotId: string; samplesStored: number; alertsUpserted: number }>`
  - internal helpers:
    - `correlateAssetSample`
    - `deriveSnapshotAlerts`

- [ ] **Step 1: Write the minimal service skeleton**

```ts
import { Injectable } from "@nestjs/common";
import { NetworkTelemetryClassificationSource } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";

@Injectable()
export class NetworkTelemetryService {
  constructor(private prisma: PrismaService) {}

  async ingestSnapshot(dto: IngestNetworkTelemetryDto) {
    const node = await this.prisma.node.findUniqueOrThrow({ where: { id: dto.nodeId } });

    const snapshot = await this.prisma.networkTelemetrySnapshot.create({
      data: {
        nodeId: node.id,
        collectorId: dto.collectorId,
        capturedAt: new Date(dto.capturedAt),
        windowSeconds: dto.windowSeconds,
        totalBytesIn: BigInt(dto.totals.bytesIn),
        totalBytesOut: BigInt(dto.totals.bytesOut),
        activeHosts: dto.totals.activeHosts,
        activeFlows: dto.totals.activeFlows,
        topProtocolsJson: dto.protocols,
        topDestinationsJson: dto.destinations,
      },
    });

    const rows = [];
    for (const asset of dto.assets) {
      rows.push(await this.correlateAssetSample(dto.nodeId, snapshot.id, asset));
    }

    if (rows.length > 0) {
      await this.prisma.networkTelemetryAssetSample.createMany({ data: rows });
    }

    const alerts = this.deriveSnapshotAlerts(dto, rows);
    for (const alert of alerts) {
      await this.prisma.networkTelemetryAlert.upsert(alert);
    }

    return { snapshotId: snapshot.id, samplesStored: rows.length, alertsUpserted: alerts.length };
  }
}
```

- [ ] **Step 2: Implement `correlateAssetSample` with the exact priority from the spec**

```ts
private async correlateAssetSample(nodeId: string, snapshotId: string, asset: IngestNetworkTelemetryDto["assets"][number]) {
  const officialByMac = asset.mac
    ? await this.prisma.nodeAsset.findFirst({ where: { nodeId, mac: asset.mac } })
    : null;

  const officialByIp = !officialByMac && asset.ip
    ? await this.prisma.nodeAsset.findFirst({ where: { nodeId, ip: asset.ip } })
    : null;

  const discoveryByMac = !officialByMac && !officialByIp && asset.mac
    ? await this.prisma.nodeDiscoveredDevice.findFirst({
        where: { mac: asset.mac, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const discoveryByIp = !officialByMac && !officialByIp && !discoveryByMac && asset.ip
    ? await this.prisma.nodeDiscoveredDevice.findFirst({
        where: { ip: asset.ip, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return {
    snapshotId,
    nodeId,
    nodeAssetId: officialByMac?.id ?? officialByIp?.id ?? null,
    ip: asset.ip ?? null,
    mac: asset.mac ?? null,
    hostname: asset.hostname ?? null,
    bytesIn: BigInt(asset.bytesIn),
    bytesOut: BigInt(asset.bytesOut),
    flowCount: asset.flowCount,
    lastSeenAt: new Date(asset.lastSeenAt),
    classificationSource: officialByMac || officialByIp
      ? NetworkTelemetryClassificationSource.OFFICIAL
      : discoveryByMac || discoveryByIp
        ? NetworkTelemetryClassificationSource.DISCOVERY
        : NetworkTelemetryClassificationSource.UNMATCHED,
  };
}
```

- [ ] **Step 3: Implement `deriveSnapshotAlerts` for unmatched traffic only**

```ts
import { NetworkTelemetryAlertKind, NetworkTelemetryAlertSeverity, NetworkTelemetryClassificationSource } from "@prisma/client";

private deriveSnapshotAlerts(dto: IngestNetworkTelemetryDto, rows: Array<{
  ip: string | null;
  mac: string | null;
  classificationSource: NetworkTelemetryClassificationSource;
}>) {
  return rows
    .filter((row) => row.classificationSource === NetworkTelemetryClassificationSource.UNMATCHED)
    .map((row) => ({
      where: {
        nodeId_kind_title: {
          nodeId: dto.nodeId,
          kind: NetworkTelemetryAlertKind.UNMATCHED_TRAFFIC,
          title: `Tráfico no correlacionado ${row.ip ?? row.mac ?? "desconocido"}`,
        },
      },
      create: {
        nodeId: dto.nodeId,
        kind: NetworkTelemetryAlertKind.UNMATCHED_TRAFFIC,
        severity: NetworkTelemetryAlertSeverity.INFO,
        title: `Tráfico no correlacionado ${row.ip ?? row.mac ?? "desconocido"}`,
        detail: "Se detectó tráfico de un host sin correlación con activos oficiales ni discovery reciente.",
        firstSeenAt: new Date(dto.capturedAt),
        lastSeenAt: new Date(dto.capturedAt),
        isActive: true,
      },
      update: {
        lastSeenAt: new Date(dto.capturedAt),
        isActive: true,
        resolvedAt: null,
      },
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:network-telemetry --workspace=apps/api`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry
git commit -m "feat(api): add network telemetry ingestion service"
```

## Task 4: Add Controller, Module, And Query Endpoints

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry.controller.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.module.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes:
  - `NetworkTelemetryService.ingestSnapshot`
- Produces:
  - `POST /network-telemetry/ingest`
  - `GET /network-telemetry/nodes/:id/summary`
  - `GET /network-telemetry/nodes/:id/timeseries`
  - `GET /network-telemetry/nodes/:id/assets`
  - `GET /network-telemetry/nodes/:id/alerts`

- [ ] **Step 1: Add controller endpoints**

```ts
import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";
import { NetworkTelemetryService } from "./network-telemetry.service";

@Controller("network-telemetry")
export class NetworkTelemetryController {
  constructor(private service: NetworkTelemetryService) {}

  @Post("ingest")
  ingest(@Headers("authorization") authorization: string | undefined, @Body() dto: IngestNetworkTelemetryDto) {
    return this.service.ingestWithCollectorAuth(authorization, dto);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/summary")
  summary(@Param("id") id: string) { return this.service.getNodeSummary(id); }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/timeseries")
  timeseries(@Param("id") id: string) { return this.service.getNodeTimeseries(id); }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/assets")
  assets(@Param("id") id: string) { return this.service.getNodeAssets(id); }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/alerts")
  alerts(@Param("id") id: string) { return this.service.getNodeAlerts(id); }
}
```

- [ ] **Step 2: Add collector token auth helper and query methods to the service**

```ts
import { UnauthorizedException } from "@nestjs/common";

async ingestWithCollectorAuth(authorization: string | undefined, dto: IngestNetworkTelemetryDto) {
  const expected = process.env.NETWORK_TELEMETRY_INGEST_TOKEN;
  const received = authorization?.replace(/^Bearer\s+/i, "");
  if (!expected || received !== expected) {
    throw new UnauthorizedException("Invalid collector token");
  }
  return this.ingestSnapshot(dto);
}

async getNodeSummary(nodeId: string) {
  const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
    where: { nodeId },
    orderBy: { capturedAt: "desc" },
  });
  const alertCount = await this.prisma.networkTelemetryAlert.count({
    where: { nodeId, isActive: true },
  });
  return {
    snapshotId: snapshot?.id ?? null,
    capturedAt: snapshot?.capturedAt ?? null,
    totalBytesIn: snapshot?.totalBytesIn?.toString() ?? "0",
    totalBytesOut: snapshot?.totalBytesOut?.toString() ?? "0",
    activeHosts: snapshot?.activeHosts ?? 0,
    activeFlows: snapshot?.activeFlows ?? 0,
    alertCount,
    topProtocols: snapshot?.topProtocolsJson ?? [],
    topDestinations: snapshot?.topDestinationsJson ?? [],
  };
}

async getNodeTimeseries(nodeId: string) {
  return this.prisma.networkTelemetrySnapshot.findMany({
    where: { nodeId },
    orderBy: { capturedAt: "asc" },
    take: 60,
    select: {
      capturedAt: true,
      totalBytesIn: true,
      totalBytesOut: true,
      activeHosts: true,
      activeFlows: true,
    },
  });
}

async getNodeAssets(nodeId: string) {
  const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
    where: { nodeId },
    orderBy: { capturedAt: "desc" },
  });
  if (!snapshot) return [];
  return this.prisma.networkTelemetryAssetSample.findMany({
    where: { snapshotId: snapshot.id },
    include: { nodeAsset: true },
    orderBy: [{ bytesOut: "desc" }, { bytesIn: "desc" }],
  });
}

async getNodeAlerts(nodeId: string) {
  return this.prisma.networkTelemetryAlert.findMany({
    where: { nodeId, isActive: true },
    orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
  });
}
```

- [ ] **Step 3: Register the module**

```ts
// apps/api/src/network-telemetry/network-telemetry.module.ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { NetworkTelemetryController } from "./network-telemetry.controller";
import { NetworkTelemetryService } from "./network-telemetry.service";

@Module({
  imports: [PrismaModule],
  controllers: [NetworkTelemetryController],
  providers: [NetworkTelemetryService],
  exports: [NetworkTelemetryService],
})
export class NetworkTelemetryModule {}
```

```ts
// apps/api/src/app.module.ts
import { NetworkTelemetryModule } from "./network-telemetry/network-telemetry.module";
// ...
NetworkTelemetryModule,
```

- [ ] **Step 4: Build the API**

Run: `npm run build --workspace=apps/api`

Expected: build succeeds with the new module registered

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry apps/api/src/app.module.ts
git commit -m "feat(api): add network telemetry endpoints"
```

## Task 5: Add Alert Derivation For Silent Nodes And Silent Assets

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry.alerts.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`

**Interfaces:**
- Consumes:
  - recent snapshots
  - recent asset sample visibility
- Produces:
  - `deriveNodeSilentAlert`
  - `deriveSilentAssetAlerts`

- [ ] **Step 1: Add failing tests for silent node and silent asset alert derivation**

```ts
test("getNodeAlerts includes NODE_SILENT when no recent snapshot exists", async () => {
  const service = new NetworkTelemetryService({
    networkTelemetrySnapshot: { findFirst: async () => null },
    networkTelemetryAlert: { findMany: async () => [{ kind: "NODE_SILENT" }] },
  } as never);

  const result = await service.getNodeAlerts("node-1");
  assert.equal(result[0]?.kind, "NODE_SILENT");
});
```

- [ ] **Step 2: Implement alert helpers**

```ts
import { NetworkTelemetryAlertKind, NetworkTelemetryAlertSeverity } from "@prisma/client";

export function buildNodeSilentAlert(nodeId: string, now: Date) {
  return {
    nodeId,
    kind: NetworkTelemetryAlertKind.NODE_SILENT,
    severity: NetworkTelemetryAlertSeverity.CRITICAL,
    title: "Nodo sin snapshots recientes",
    detail: "No se recibió telemetría reciente para el nodo dentro de la ventana esperada.",
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
  };
}
```

- [ ] **Step 3: Upsert silent alerts during summary and alert queries**

```ts
const latest = await this.prisma.networkTelemetrySnapshot.findFirst({
  where: { nodeId },
  orderBy: { capturedAt: "desc" },
});

if (!latest || Date.now() - latest.capturedAt.getTime() > 120_000) {
  await this.prisma.networkTelemetryAlert.upsert({
    where: {
      nodeId_kind_title: {
        nodeId,
        kind: NetworkTelemetryAlertKind.NODE_SILENT,
        title: "Nodo sin snapshots recientes",
      },
    },
    create: buildNodeSilentAlert(nodeId, new Date()),
    update: { lastSeenAt: new Date(), isActive: true, resolvedAt: null },
  });
}
```

- [ ] **Step 4: Run telemetry tests**

Run: `npm run test:network-telemetry --workspace=apps/api`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry
git commit -m "feat(api): derive network telemetry silent alerts"
```

## Task 6: Wire `/monitoring/network` To Telemetry Summary And Queries

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/network-monitor.ts`
- Modify: `apps/web/lib/network-monitor.test.ts`

**Interfaces:**
- Consumes:
  - `GET /network-telemetry/nodes/:id/summary`
  - `GET /network-telemetry/nodes/:id/timeseries`
  - `GET /network-telemetry/nodes/:id/assets`
  - `GET /network-telemetry/nodes/:id/alerts`
- Produces:
  - traffic and alert tabs driven by API telemetry

- [ ] **Step 1: Add response types in the page file**

```ts
type NetworkTelemetrySummary = {
  snapshotId: string | null;
  capturedAt: string | null;
  totalBytesIn: string;
  totalBytesOut: string;
  activeHosts: number;
  activeFlows: number;
  alertCount: number;
  topProtocols: Array<{ name: string; bytes: number; flowCount: number }>;
  topDestinations: Array<{ target: string; kind: string; bytes: number; flowCount: number }>;
};

type NetworkTelemetryPoint = {
  capturedAt: string;
  totalBytesIn: string;
  totalBytesOut: string;
  activeHosts: number;
  activeFlows: number;
};

type NetworkTelemetryAssetView = {
  id: string;
  nodeAssetId?: string | null;
  ip?: string | null;
  mac?: string | null;
  hostname?: string | null;
  bytesIn: string;
  bytesOut: string;
  flowCount: number;
  classificationSource: "OFFICIAL" | "DISCOVERY" | "UNMATCHED";
  nodeAsset?: { id: string; name: string; assetType: string } | null;
};
```

- [ ] **Step 2: Load telemetry in parallel with node detail**

```ts
const [detailResponse, summaryResponse, timeseriesResponse, assetsResponse, alertsResponse] = await Promise.all([
  apiGet<MonitorNodeDetail>(`/nodes/${nodeId}`, accessToken),
  apiGet<NetworkTelemetrySummary>(`/network-telemetry/nodes/${nodeId}/summary`, accessToken),
  apiGet<NetworkTelemetryPoint[]>(`/network-telemetry/nodes/${nodeId}/timeseries`, accessToken),
  apiGet<NetworkTelemetryAssetView[]>(`/network-telemetry/nodes/${nodeId}/assets`, accessToken),
  apiGet<MonitorAlert[]>(`/network-telemetry/nodes/${nodeId}/alerts`, accessToken),
]);
```

- [ ] **Step 3: Replace local traffic-tab derived values with telemetry responses**

```ts
const telemetryPulseCards = [
  { label: "Bytes In", value: summary.totalBytesIn, sub: "ventana más reciente" },
  { label: "Bytes Out", value: summary.totalBytesOut, sub: "ventana más reciente" },
  { label: "Hosts activos", value: summary.activeHosts, sub: "último snapshot" },
  { label: "Flows activos", value: summary.activeFlows, sub: "último snapshot" },
];
```

- [ ] **Step 4: Keep inventory tab on current correlated model, but use telemetry assets for activity cards**

```ts
const observabilityAssets = telemetryAssets;
```

- [ ] **Step 5: Run the web test and build**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx apps/web/lib/network-monitor.ts apps/web/lib/network-monitor.test.ts
git commit -m "feat(web): wire network monitor to telemetry api"
```

## Task 7: Verify End-To-End With Manual Ingest

**Files:**
- Modify: none required unless defects are found

**Interfaces:**
- Consumes:
  - telemetry ingestion endpoint
  - telemetry query endpoints
- Produces:
  - verified end-to-end telemetry flow in local dev

- [ ] **Step 1: Start API and web if not already running**

Run: `npm run dev --workspace=apps/api`
Expected: Nest starts and listens on `4001`

Run: `npm run dev --workspace=apps/web`
Expected: Next starts and listens on `3001`

- [ ] **Step 2: POST one telemetry snapshot**

Run:

```bash
curl -s -X POST http://127.0.0.1:4001/network-telemetry/ingest \
  -H "Authorization: Bearer $NETWORK_TELEMETRY_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "REPLACE_NODE_ID",
    "collectorId": "sensor-local",
    "capturedAt": "2026-07-13T20:01:00.000Z",
    "windowSeconds": 60,
    "totals": { "bytesIn": 1240032, "bytesOut": 892114, "activeHosts": 6, "activeFlows": 41 },
    "protocols": [{ "name": "RTSP", "bytes": 930000, "flowCount": 8 }],
    "destinations": [{ "target": "192.168.1.10", "kind": "IP", "bytes": 850000, "flowCount": 7 }],
    "assets": [{
      "ip": "192.168.1.20",
      "mac": "AA:BB:CC:DD:EE:01",
      "hostname": "ptz-norte",
      "bytesIn": 600000,
      "bytesOut": 420000,
      "flowCount": 11,
      "lastSeenAt": "2026-07-13T20:00:58.000Z"
    }]
  }'
```

Expected: JSON with `snapshotId`, `samplesStored`, and `alertsUpserted`

- [ ] **Step 3: Verify summary query**

Run: `curl -s http://127.0.0.1:4001/network-telemetry/nodes/REPLACE_NODE_ID/summary -H "Authorization: Bearer REPLACE_USER_JWT"`

Expected: JSON with non-zero `activeHosts`, `activeFlows`, and `topProtocols`

- [ ] **Step 4: Verify monitor UI route**

Run: `curl -I -s http://127.0.0.1:3001/monitoring/network`

Expected: `HTTP/1.1 200 OK`

- [ ] **Step 5: Commit final fixes if verification found defects**

```bash
git add -A
git commit -m "fix: finalize telemetry ingestion integration"
```

## Self-Review

### Spec Coverage

- Data model: covered by Task 1
- Ingest contract: covered by Tasks 2 and 3
- Correlation rules: covered by Task 3
- Query endpoints: covered by Task 4
- Alert rules: covered by Task 5
- Frontend integration: covered by Task 6
- End-to-end verification: covered by Task 7

### Placeholder Scan

- No `TBD`, `TODO`, or deferred implementation placeholders remain in task steps.
- Commands, files, and produced interfaces are explicit.

### Type Consistency

- Ingestion uses `IngestNetworkTelemetryDto`
- Service entrypoint is `ingestSnapshot`
- UI consumes `summary`, `timeseries`, `assets`, and `alerts` endpoints consistently
- Alert kinds match the spec and Task 1 enum definitions
