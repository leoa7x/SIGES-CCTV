# ntopng And External Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an embedded `ntopng` traffic tab to `/monitoring/network`, persist out-of-subnet findings separately from official inventory, and remove silent mock discovery behavior from real CMC/node discovery flows.

**Architecture:** Extend the current monitoring stack in three bounded areas: a new backend module for external findings, stricter discovery execution rules in the existing discovery services, and a new `Tráfico` tab in the monitoring UI backed by a small `ntopng` embed adapter. Official inventory stays in `CenterAsset`/`NodeAsset`; out-of-subnet observations become `ExternalDiscoveryFinding` records with explicit operator actions.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 15, TypeScript, node:test, ts-node

## Global Constraints

- `/monitoring/network` must include an embedded `ntopng` traffic view.
- The system must show operational signals for "sin línea", "sin tráfico", and "caído".
- Discovery must run only with real scanners in production-like use, never with silent mock results.
- Hosts found outside the expected CMC subnet must be stored and reviewed separately.
- Operators must be able to confirm those external findings without polluting official CMC or node inventories.
- `ntopng` must be an additional traffic/visibility layer, not a replacement for inventory or discovery.
- Official assets, discovered-but-unconfirmed assets, and external/out-of-subnet findings must remain separate concepts.
- If `LAN_ORANGUTAN_CMD` is not configured, the discovery request must fail explicitly unless an explicit mock mode flag enables mock behavior.
- If the command succeeds and finds zero hosts, the job is valid and must remain `COMPLETED` with zero results.
- Any discovered host outside the expected subnet must not be merged into `CenterAsset`; it must be stored as an external finding.

---

### Task 1: Add Prisma Model And Backend Module For External Findings

**Files:**
- Create: `apps/api/src/external-discovery/external-discovery.service.ts`
- Create: `apps/api/src/external-discovery/external-discovery.controller.ts`
- Create: `apps/api/src/external-discovery/external-discovery.module.ts`
- Create: `apps/api/src/external-discovery/external-discovery.service.test.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/external-discovery/external-discovery.service.test.ts`

**Interfaces:**
- Consumes:
  - `PrismaService`
  - `Permission.MANAGE_ORG`
- Produces:
  - Prisma model `ExternalDiscoveryFinding`
  - service methods:
    - `upsertScanFindings(centerId: string, expectedSubnetCidr: string | null, observedFromTargetIp: string | null, devices: ExternalFindingInput[], source: "SCAN" | "NTOPNG"): Promise<void>`
    - `listByCenter(centerId: string): Promise<ExternalDiscoveryFinding[]>`
    - `setStatus(id: string, status: "PENDING" | "IGNORED" | "CONFIRMED"): Promise<{ ok: true }>`

- [ ] **Step 1: Write the failing service tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { ExternalDiscoveryService } from "./external-discovery.service";

test("upsertScanFindings stores out-of-subnet devices as pending external findings", async () => {
  const upserts: unknown[] = [];
  const service = new ExternalDiscoveryService({
    externalDiscoveryFinding: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "finding-1" };
      },
      findMany: async () => [],
      update: async () => ({ id: "finding-1" }),
    },
  } as never);

  await service.upsertScanFindings(
    "center-1",
    "172.16.45.0/24",
    "172.16.45.1",
    [{ ip: "172.16.46.10", mac: "AA:BB:CC:00:11:22", vendor: "Cisco", hostname: "edge-host", model: "X", candidateType: "SWITCH", discoveryConfidence: 71 }],
    "SCAN",
  );

  assert.equal(upserts.length, 1);
});

test("setStatus updates an external finding status", async () => {
  let updateArgs: unknown = null;
  const service = new ExternalDiscoveryService({
    externalDiscoveryFinding: {
      upsert: async () => ({ id: "finding-1" }),
      findMany: async () => [],
      update: async (args: unknown) => {
        updateArgs = args;
        return { id: "finding-1" };
      },
    },
  } as never);

  const result = await service.setStatus("finding-1", "CONFIRMED");

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(updateArgs, { where: { id: "finding-1" }, data: { status: "CONFIRMED" } });
});
```

- [ ] **Step 2: Run the new test file to verify it fails**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/external-discovery/external-discovery.service.test.ts`

Expected: FAIL because the `external-discovery` module and/or Prisma model do not exist yet.

- [ ] **Step 3: Add the Prisma schema for external findings**

```prisma
enum ExternalFindingStatus {
  PENDING
  IGNORED
  CONFIRMED
}

enum ExternalFindingSource {
  SCAN
  NTOPNG
  SCAN_AND_NTOPNG
}

model ExternalDiscoveryFinding {
  id                   String                @id @default(uuid())
  centerId             String
  center               MonitoringCenter      @relation(fields: [centerId], references: [id])
  source               ExternalFindingSource @default(SCAN)
  ip                   String?
  mac                  String?
  vendor               String?
  model                String?
  hostname             String?
  candidateType        NodeAssetType?
  discoveryConfidence  Int?
  outsideExpectedSubnet Boolean              @default(true)
  expectedSubnetCidr   String?
  observedFromTargetIp String?
  status               ExternalFindingStatus @default(PENDING)
  firstSeenAt          DateTime
  lastSeenAt           DateTime
  lastDiscoveryJobId   String?
  notes                String?
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  @@index([centerId, status])
  @@unique([centerId, ip, mac])
}
```

- [ ] **Step 4: Implement the backend module and service minimally**

```ts
// apps/api/src/external-discovery/external-discovery.service.ts
import { Injectable } from "@nestjs/common";
import { NodeAssetType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type ExternalFindingInput = {
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  candidateType?: NodeAssetType | null;
  discoveryConfidence?: number | null;
};

@Injectable()
export class ExternalDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertScanFindings(
    centerId: string,
    expectedSubnetCidr: string | null,
    observedFromTargetIp: string | null,
    devices: ExternalFindingInput[],
    source: "SCAN" | "NTOPNG",
  ) {
    const now = new Date();

    for (const device of devices) {
      await this.prisma.externalDiscoveryFinding.upsert({
        where: {
          centerId_ip_mac: {
            centerId,
            ip: device.ip ?? null,
            mac: device.mac ?? null,
          },
        },
        create: {
          centerId,
          source,
          ip: device.ip ?? null,
          mac: device.mac ?? null,
          vendor: device.vendor ?? null,
          model: device.model ?? null,
          hostname: device.hostname ?? null,
          candidateType: device.candidateType ?? null,
          discoveryConfidence: device.discoveryConfidence ?? null,
          outsideExpectedSubnet: true,
          expectedSubnetCidr,
          observedFromTargetIp,
          status: "PENDING",
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          source,
          vendor: device.vendor ?? null,
          model: device.model ?? null,
          hostname: device.hostname ?? null,
          candidateType: device.candidateType ?? null,
          discoveryConfidence: device.discoveryConfidence ?? null,
          expectedSubnetCidr,
          observedFromTargetIp,
          lastSeenAt: now,
        },
      });
    }
  }

  listByCenter(centerId: string) {
    return this.prisma.externalDiscoveryFinding.findMany({
      where: { centerId },
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    });
  }

  async setStatus(id: string, status: "PENDING" | "IGNORED" | "CONFIRMED") {
    await this.prisma.externalDiscoveryFinding.update({
      where: { id },
      data: { status },
    });
    return { ok: true };
  }
}
```

- [ ] **Step 5: Add the controller and module wiring**

```ts
// apps/api/src/external-discovery/external-discovery.controller.ts
import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ExternalDiscoveryService } from "./external-discovery.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("external-discovery")
export class ExternalDiscoveryController {
  constructor(private readonly service: ExternalDiscoveryService) {}

  @Get("centers/:centerId")
  listByCenter(@Param("centerId") centerId: string) {
    return this.service.listByCenter(centerId);
  }

  @RequirePermissions(Permission.MANAGE_ORG)
  @Patch(":id/status")
  setStatus(@Param("id") id: string, @Body() body: { status: "PENDING" | "IGNORED" | "CONFIRMED" }) {
    return this.service.setStatus(id, body.status);
  }
}
```

```ts
// apps/api/src/external-discovery/external-discovery.module.ts
import { Module } from "@nestjs/common";
import { ExternalDiscoveryController } from "./external-discovery.controller";
import { ExternalDiscoveryService } from "./external-discovery.service";

@Module({
  controllers: [ExternalDiscoveryController],
  providers: [ExternalDiscoveryService],
  exports: [ExternalDiscoveryService],
})
export class ExternalDiscoveryModule {}
```

```ts
// apps/api/src/app.module.ts
import { ExternalDiscoveryModule } from "./external-discovery/external-discovery.module";

@Module({
  imports: [
    ExternalDiscoveryModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Run the service test to verify it passes**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/external-discovery/external-discovery.service.test.ts`

Expected: PASS with both tests green.

- [ ] **Step 7: Run Prisma/client and API build verification**

Run: `npm --prefix apps/api run build`

Expected: `nest build` completes successfully.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/app.module.ts apps/api/src/external-discovery
git commit -m "feat: add external discovery persistence"
```

### Task 2: Remove Silent Mock Fallback And Classify Out-Of-Subnet CMC Findings

**Files:**
- Modify: `apps/api/src/center-discovery/center-discovery.service.ts`
- Modify: `apps/api/src/center-discovery/center-discovery.service.test.ts`
- Modify: `apps/api/src/node-discovery/node-discovery.service.ts`
- Modify: `apps/api/src/node-discovery/node-discovery.utils.ts`
- Modify: `apps/api/src/center-discovery/center-discovery.utils.ts`
- Modify: `apps/api/src/center-discovery/center-discovery.module.ts`
- Modify: `.env.example`
- Test: `apps/api/src/center-discovery/center-discovery.service.test.ts`

**Interfaces:**
- Consumes:
  - `ExternalDiscoveryService.upsertScanFindings(...)`
  - `LAN_ORANGUTAN_CMD`
  - optional `DISCOVERY_ALLOW_MOCK`
- Produces:
  - `CenterDiscoveryService.runForCenter(centerId: string, requestedByUserId?: string): Promise<CenterDiscoveryJob>`
  - `NodeDiscoveryService.runForNode(nodeId: string, requestedByUserId?: string): Promise<NodeDiscoveryJob>`
  - explicit runtime failure when no real scanner command is configured and mock mode is disabled

- [ ] **Step 1: Write failing tests for strict discovery and out-of-subnet classification**

```ts
test("CMC discovery fails when LAN_ORANGUTAN_CMD is missing and DISCOVERY_ALLOW_MOCK is not enabled", async () => {
  const originalCommand = process.env.LAN_ORANGUTAN_CMD;
  const originalMock = process.env.DISCOVERY_ALLOW_MOCK;
  delete process.env.LAN_ORANGUTAN_CMD;
  delete process.env.DISCOVERY_ALLOW_MOCK;

  const service = new CenterDiscoveryService({
    monitoringCenter: {
      findUniqueOrThrow: async () => ({ id: "center-1", primaryIp: "172.16.45.1", scanSubnetCidr: "172.16.45.0/24" }),
    },
    centerDiscoveryJob: {
      create: async () => ({ id: "job-1" }),
      update: async () => ({ id: "job-1" }),
      findUniqueOrThrow: async () => ({ id: "job-1", discoveredDevices: [] }),
    },
    centerDiscoveredDevice: { createMany: async () => ({ count: 0 }) },
  } as never, {} as never, {} as never);

  await assert.rejects(() => service.runForCenter("center-1"), /LAN_ORANGUTAN_CMD/i);

  if (originalCommand == null) delete process.env.LAN_ORANGUTAN_CMD;
  else process.env.LAN_ORANGUTAN_CMD = originalCommand;
  if (originalMock == null) delete process.env.DISCOVERY_ALLOW_MOCK;
  else process.env.DISCOVERY_ALLOW_MOCK = originalMock;
});

test("CMC discovery stores out-of-subnet findings separately instead of creating discovered devices", async () => {
  let externalArgs: unknown[] = [];
  let createManyCalled = false;

  const externalDiscoveryService = {
    upsertScanFindings: async (...args: unknown[]) => {
      externalArgs.push(args);
    },
  };

  const service = new CenterDiscoveryService({
    monitoringCenter: {
      findUniqueOrThrow: async () => ({ id: "center-1", primaryIp: "172.16.45.1", scanSubnetCidr: "172.16.45.0/24" }),
    },
    centerDiscoveryJob: {
      create: async () => ({ id: "job-1" }),
      update: async () => ({ id: "job-1" }),
      findUniqueOrThrow: async () => ({ id: "job-1", discoveredDevices: [] }),
    },
    centerDiscoveredDevice: {
      createMany: async () => {
        createManyCalled = true;
        return { count: 0 };
      },
    },
  } as never, {} as never, externalDiscoveryService as never);

  (service as any).executeDiscovery = async () => [
    { ip: "172.16.45.20", mac: "AA:BB:CC:00:00:20", type: "switch", confidence: 80 },
    { ip: "172.16.46.10", mac: "AA:BB:CC:00:00:46", type: "switch", confidence: 81 },
  ];
  (service as any).reconcileCenterAssets = async () => {};

  await service.runForCenter("center-1");

  assert.equal(createManyCalled, true);
  assert.equal(externalArgs.length, 1);
});
```

- [ ] **Step 2: Run the center discovery tests to verify they fail**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/center-discovery/center-discovery.service.test.ts`

Expected: FAIL because the service still silently falls back to mock behavior and does not classify external findings separately.

- [ ] **Step 3: Inject `ExternalDiscoveryService` into the center discovery module**

```ts
// apps/api/src/center-discovery/center-discovery.module.ts
import { ExternalDiscoveryModule } from "../external-discovery/external-discovery.module";

@Module({
  imports: [ExternalDiscoveryModule],
})
export class CenterDiscoveryModule {}
```

```ts
// apps/api/src/center-discovery/center-discovery.service.ts
import { ExternalDiscoveryService } from "../external-discovery/external-discovery.service";

constructor(
  private readonly prisma: PrismaService,
  private readonly centerAssetsService: CenterAssetsService,
  private readonly externalDiscoveryService: ExternalDiscoveryService,
) {}
```

- [ ] **Step 4: Remove default mock fallback and gate it behind `DISCOVERY_ALLOW_MOCK`**

```ts
private async executeDiscovery(targetSubnetCidr: string, targetIp?: string) {
  const commandTemplate = process.env.LAN_ORANGUTAN_CMD?.trim();
  const allowMock = process.env.DISCOVERY_ALLOW_MOCK === "true";

  if (!commandTemplate) {
    if (allowMock) return this.buildMockResults(targetSubnetCidr, targetIp);
    throw new Error("LAN_ORANGUTAN_CMD debe estar configurado para ejecutar discovery real");
  }

  // existing real command execution path continues here
}
```

Apply the same pattern in `NodeDiscoveryService.executeDiscovery`.

- [ ] **Step 5: Classify in-subnet vs out-of-subnet devices in CMC discovery**

```ts
import { isIpInSubnet } from "./center-discovery.utils";

const normalized = normalizeCenterDiscoveredDevices(rawDevices);
const expectedSubnet = center.scanSubnetCidr || deriveSubnetFromIp(center.primaryIp || "");
const inSubnet = normalized.filter((device) => !device.ip || isIpInSubnet(device.ip, expectedSubnet));
const outOfSubnet = normalized.filter((device) => device.ip && !isIpInSubnet(device.ip, expectedSubnet));

await this.reconcileCenterAssets(centerId, inSubnet);

if (inSubnet.length > 0) {
  await this.prisma.centerDiscoveredDevice.createMany({
    data: inSubnet.map((device) => ({
      centerDiscoveryJobId: job.id,
      ...device,
      rawPayload: device.rawPayload as Prisma.InputJsonValue,
    })),
  });
}

if (outOfSubnet.length > 0) {
  await this.externalDiscoveryService.upsertScanFindings(
    centerId,
    expectedSubnet || null,
    center.primaryIp || null,
    outOfSubnet,
    "SCAN",
  );
}
```

- [ ] **Step 6: Add the subnet helper used by the service**

```ts
// apps/api/src/center-discovery/center-discovery.utils.ts
import ipaddr from "ipaddr.js";

export function isIpInSubnet(ip: string, cidr: string) {
  try {
    const [range, prefix] = ipaddr.parseCIDR(cidr);
    return ipaddr.parse(ip).match(range, prefix);
  } catch {
    return false;
  }
}
```

If the repo already avoids `ipaddr.js`, implement the same logic with a lightweight IPv4 numeric helper instead of adding a new dependency.

- [ ] **Step 7: Document the stricter runtime behavior in `.env.example`**

```env
# Real discovery command. Required unless DISCOVERY_ALLOW_MOCK=true
LAN_ORANGUTAN_CMD=python3 /absolute/path/to/SIGES-CCTV/apps/api/scripts/run_lan_orangutan_scan.py {target}

# Development-only escape hatch. Never enable in production.
DISCOVERY_ALLOW_MOCK=false
```

- [ ] **Step 8: Re-run the center discovery test file**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/center-discovery/center-discovery.service.test.ts`

Expected: PASS, including the new strict-discovery and out-of-subnet cases.

- [ ] **Step 9: Run API build verification**

Run: `npm --prefix apps/api run build`

Expected: `nest build` completes successfully.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/center-discovery apps/api/src/node-discovery .env.example
git commit -m "feat: enforce real discovery and store external findings"
```

### Task 3: Add ntopng Embed Adapter And Monitoring API Surface

**Files:**
- Create: `apps/api/src/ntopng-observability/ntopng-observability.service.ts`
- Create: `apps/api/src/ntopng-observability/ntopng-observability.controller.ts`
- Create: `apps/api/src/ntopng-observability/ntopng-observability.module.ts`
- Create: `apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `.env.example`
- Test: `apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`

**Interfaces:**
- Consumes:
  - `NEXT_PUBLIC_*` is not used here; backend owns embed descriptors
  - env vars:
    - `NTOPNG_BASE_URL`
    - `NTOPNG_EMBED_PATH`
- Produces:
  - `GET /observability/embed/ntopng-traffic?centerId=:id`
  - response shape:
    - `{ title: string; dashboard: "network-command-view"; url: string; params: Record<string, string> }`

- [ ] **Step 1: Write the failing ntopng adapter test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NtopngObservabilityService } from "./ntopng-observability.service";

test("buildTrafficEmbed returns a sanitized descriptor for ntopng", async () => {
  process.env.NTOPNG_BASE_URL = "http://127.0.0.1:3002";
  process.env.NTOPNG_EMBED_PATH = "/lua/hosts_stats.lua";

  const service = new NtopngObservabilityService();
  const descriptor = await service.buildTrafficEmbed("center-1");

  assert.equal(descriptor.title, "Tráfico ntopng");
  assert.equal(descriptor.url.startsWith("http://127.0.0.1:3002"), true);
});
```

- [ ] **Step 2: Run the new ntopng test to verify it fails**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`

Expected: FAIL because the adapter module does not exist yet.

- [ ] **Step 3: Implement the adapter service, controller, and module**

```ts
// apps/api/src/ntopng-observability/ntopng-observability.service.ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class NtopngObservabilityService {
  async buildTrafficEmbed(centerId?: string) {
    const baseUrl = process.env.NTOPNG_BASE_URL?.trim();
    const embedPath = process.env.NTOPNG_EMBED_PATH?.trim() || "/";

    if (!baseUrl) {
      throw new Error("NTOPNG_BASE_URL no está configurado");
    }

    const params = centerId ? { centerId } : {};
    const url = `${baseUrl}${embedPath}`;

    return {
      title: "Tráfico ntopng",
      dashboard: "network-command-view" as const,
      url,
      params,
    };
  }
}
```

```ts
// apps/api/src/ntopng-observability/ntopng-observability.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NtopngObservabilityService } from "./ntopng-observability.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("observability/embed")
export class NtopngObservabilityController {
  constructor(private readonly service: NtopngObservabilityService) {}

  @Get("ntopng-traffic")
  traffic(@Query("centerId") centerId?: string) {
    return this.service.buildTrafficEmbed(centerId);
  }
}
```

- [ ] **Step 4: Add environment documentation**

```env
NTOPNG_BASE_URL=http://127.0.0.1:3002
NTOPNG_EMBED_PATH=/lua/hosts_stats.lua
```

- [ ] **Step 5: Re-run the ntopng adapter test**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Run API build verification**

Run: `npm --prefix apps/api run build`

Expected: `nest build` completes successfully.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ntopng-observability .env.example apps/api/src/app.module.ts
git commit -m "feat: add ntopng embed adapter"
```

### Task 4: Extend `/monitoring/network` With Traffic Tab And External Findings UI

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Create: `apps/web/lib/external-discovery.ts`
- Create: `apps/web/lib/external-discovery.test.ts`
- Modify: `apps/web/lib/network-monitor.ts`
- Modify: `apps/web/lib/network-monitor.test.ts`
- Test: `apps/web/lib/network-monitor.test.ts`
- Test: `apps/web/lib/external-discovery.test.ts`

**Interfaces:**
- Consumes:
  - `GET /external-discovery/centers/:centerId`
  - `PATCH /external-discovery/:id/status`
  - `GET /observability/embed/ntopng-traffic?centerId=:id`
  - `buildNetworkMonitorModel(...)`
- Produces:
  - new UI tab `"trafico"`
  - helper types:
    - `ExternalFindingRow`
    - `TrafficTabModel`

- [ ] **Step 1: Write a failing model test for external findings and traffic summary**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { buildNetworkMonitorModel } from "./network-monitor";

test("buildNetworkMonitorModel reports external findings count separately from official inventory", () => {
  const model = buildNetworkMonitorModel(
    [],
    {
      id: "node-1",
      code: "N-1",
      name: "Nodo 1",
      primaryIp: "172.16.45.1",
      scanSubnetCidr: "172.16.45.0/24",
      operativeState: "ONLINE",
      route: { identifier: "RUTA-1", center: { id: "center-1", name: "CMC", } },
      assets: [],
      discoveryJobs: [],
    } as never,
    [],
    [{ id: "finding-1", ip: "172.16.46.10", status: "PENDING", source: "SCAN" }] as never,
  );

  assert.equal(model.trafficSummary.pendingExternalFindings, 1);
});
```

- [ ] **Step 2: Run the web tests to verify they fail**

Run: `npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/network-monitor.test.ts`

Expected: FAIL because the model does not yet include external findings/traffic summary fields.

- [ ] **Step 3: Add a focused API helper for external findings**

```ts
// apps/web/lib/external-discovery.ts
import { apiGet, apiPatch } from "./api";

export type ExternalFinding = {
  id: string;
  centerId: string;
  source: "SCAN" | "NTOPNG" | "SCAN_AND_NTOPNG";
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  status: "PENDING" | "IGNORED" | "CONFIRMED";
  firstSeenAt: string;
  lastSeenAt: string;
};

export function getExternalFindings(centerId: string, token: string) {
  return apiGet<ExternalFinding[]>(`/external-discovery/centers/${centerId}`, token);
}

export function setExternalFindingStatus(id: string, status: ExternalFinding["status"], token: string) {
  return apiPatch(`/external-discovery/${id}/status`, token, { status });
}
```

- [ ] **Step 4: Extend `buildNetworkMonitorModel` with a traffic summary block**

```ts
trafficSummary: {
  pendingExternalFindings: externalFindings.filter((item) => item.status === "PENDING").length,
  confirmedExternalFindings: externalFindings.filter((item) => item.status === "CONFIRMED").length,
  ignoredExternalFindings: externalFindings.filter((item) => item.status === "IGNORED").length,
  offlineOfficialAssets: detail.assets.filter((asset) => asset.operativeState === "OFFLINE").length,
}
```

Keep the existing inventory/alerts model intact; add a new top-level summary instead of overloading current counters.

- [ ] **Step 5: Load the ntopng embed descriptor and external findings in `page.tsx`**

```ts
const [externalFindings, setExternalFindings] = useState<ExternalFinding[]>([]);
const [trafficEmbedDescriptor, setTrafficEmbedDescriptor] = useState<GrafanaEmbedDescriptor | null>(null);

// inside loadDetail success path
const [summaryResponse, timeseriesResponse, assetsResponse, alertsResponse, centerAssetsResponse, externalFindingsResponse, trafficEmbedResponse] = await Promise.all([
  apiGet<NetworkTelemetrySummary>(`/network-telemetry/nodes/${nodeId}/summary`, accessToken),
  apiGet<NetworkTelemetryPoint[]>(`/network-telemetry/nodes/${nodeId}/timeseries`, accessToken),
  apiGet<NetworkTelemetryAssetView[]>(`/network-telemetry/nodes/${nodeId}/assets`, accessToken),
  apiGet<NetworkTelemetryAlert[]>(`/network-telemetry/nodes/${nodeId}/alerts`, accessToken),
  apiGet<MonitorCenterAsset[]>(`/network-telemetry/centers/${centerId}/official-assets`, accessToken),
  getExternalFindings(centerId, accessToken),
  apiGet<GrafanaEmbedDescriptor>(`/observability/embed/ntopng-traffic?centerId=${encodeURIComponent(centerId)}`, accessToken),
]);
```

- [ ] **Step 6: Add the new `trafico` tab and render block**

```tsx
<button onClick={() => setTab("trafico")} className={tabClass(tab === "trafico")}>Tráfico</button>
```

```tsx
{tab === "trafico" ? (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-4">
      <SummaryCard label="Hallazgos externos pendientes" value={String(model.trafficSummary.pendingExternalFindings)} />
      <SummaryCard label="Externos confirmados" value={String(model.trafficSummary.confirmedExternalFindings)} />
      <SummaryCard label="Externos ignorados" value={String(model.trafficSummary.ignoredExternalFindings)} />
      <SummaryCard label="Activos oficiales caídos" value={String(model.trafficSummary.offlineOfficialAssets)} />
    </div>

    <section className="rounded-ops border border-ops-border bg-ops-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ops-text">Hallazgos externos</p>
      </div>
      {externalFindings.length === 0 ? (
        <p className="text-sm text-ops-muted">No hay hallazgos externos registrados para este CMC.</p>
      ) : (
        <div className="space-y-2">
          {externalFindings.map((finding) => (
            <div key={finding.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ops-text">{finding.ip ?? "sin IP"} · {finding.hostname ?? "sin hostname"}</p>
                  <p className="mt-1 text-[11px] text-ops-muted">{finding.mac ?? "sin MAC"} · {finding.vendor ?? "sin fabricante"} · {finding.source}</p>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <button onClick={() => void handleExternalFindingStatus(finding.id, "CONFIRMED")} className="text-ops-blue hover:underline">Confirmar</button>
                  <button onClick={() => void handleExternalFindingStatus(finding.id, "IGNORED")} className="text-ops-rose hover:underline">Ignorar</button>
                  <button onClick={() => void handleExternalFindingStatus(finding.id, "PENDING")} className="text-ops-muted hover:underline">Pendiente</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>

    <section className="rounded-ops border border-ops-border bg-ops-panel p-4">
      {trafficEmbedDescriptor ? <GrafanaEmbedCard descriptor={trafficEmbedDescriptor} /> : <p className="text-sm text-ops-muted">ntopng no está disponible.</p>}
    </section>
  </div>
) : null}
```

- [ ] **Step 7: Add a targeted web test for the external discovery helper**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import type { ExternalFinding } from "./external-discovery";

test("ExternalFinding shape supports pending/ignored/confirmed workflow", () => {
  const finding: ExternalFinding = {
    id: "finding-1",
    centerId: "center-1",
    source: "SCAN",
    ip: "172.16.46.10",
    mac: "AA:BB:CC:00:11:22",
    vendor: "Cisco",
    model: null,
    hostname: "edge-host",
    status: "PENDING",
    firstSeenAt: "2026-07-19T17:00:00.000Z",
    lastSeenAt: "2026-07-19T17:05:00.000Z",
  };

  assert.equal(finding.status, "PENDING");
});
```

- [ ] **Step 8: Run the web tests**

Run:
- `npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/network-monitor.test.ts`
- `npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/external-discovery.test.ts`

Expected: PASS.

- [ ] **Step 9: Run web build verification**

Run: `npm --prefix apps/web run build`

Expected: `next build` completes successfully and includes `/monitoring/network`.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx apps/web/lib/network-monitor.ts apps/web/lib/network-monitor.test.ts apps/web/lib/external-discovery.*
git commit -m "feat: add ntopng traffic tab and external findings UI"
```

### Task 5: Wire ntopng Findings Into External Discovery And Final Verification

**Files:**
- Modify: `apps/api/src/ntopng-observability/ntopng-observability.service.ts`
- Modify: `apps/api/src/external-discovery/external-discovery.service.ts`
- Modify: `apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Test: `apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`

**Interfaces:**
- Consumes:
  - `ExternalDiscoveryService.upsertScanFindings(...)`
  - ntopng adapter env vars
- Produces:
  - optional `syncExternalTrafficFindings(centerId: string, rows: ExternalFindingInput[]): Promise<void>`
  - unified source `SCAN_AND_NTOPNG` when the same IP/MAC is seen by both systems

- [ ] **Step 1: Write the failing ntopng correlation test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { ExternalDiscoveryService } from "../external-discovery/external-discovery.service";

test("upsertScanFindings upgrades source to SCAN_AND_NTOPNG when the same host is seen twice", async () => {
  let updateArgs: unknown = null;
  const service = new ExternalDiscoveryService({
    externalDiscoveryFinding: {
      upsert: async (args: any) => {
        updateArgs = args;
        return { id: "finding-1" };
      },
      findMany: async () => [],
      update: async () => ({ id: "finding-1" }),
    },
  } as never);

  await service.upsertScanFindings("center-1", "172.16.45.0/24", "172.16.45.1", [{ ip: "172.16.46.10", mac: "AA:BB:CC:00:11:22" }], "SCAN_AND_NTOPNG");

  assert.ok(updateArgs);
});
```

- [ ] **Step 2: Run the external discovery service test file**

Run: `npx ts-node --project apps/api/tsconfig.json apps/api/src/external-discovery/external-discovery.service.test.ts`

Expected: FAIL if source merge logic is still missing.

- [ ] **Step 3: Add source merge logic in the service**

```ts
function mergeSource(current: "SCAN" | "NTOPNG" | "SCAN_AND_NTOPNG" | null | undefined, incoming: "SCAN" | "NTOPNG") {
  if (!current || current === incoming) return incoming;
  return "SCAN_AND_NTOPNG";
}
```

Use it in the `update` branch of `upsertScanFindings`.

- [ ] **Step 4: Add a bounded ntopng ingestion/sync method**

```ts
async syncExternalTrafficFindings(centerId: string, expectedSubnetCidr: string | null, rows: ExternalFindingInput[]) {
  await this.upsertScanFindings(centerId, expectedSubnetCidr, null, rows, "NTOPNG");
}
```

Keep this method purely additive in v1. Do not make ntopng own official asset state changes yet.

- [ ] **Step 5: Re-run the backend tests**

Run:
- `npx ts-node --project apps/api/tsconfig.json apps/api/src/external-discovery/external-discovery.service.test.ts`
- `npx ts-node --project apps/api/tsconfig.json apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Run full targeted verification**

Run:
- `npm --prefix apps/api run build`
- `npm --prefix apps/web run build`
- `npx ts-node --project apps/api/tsconfig.json apps/api/src/center-discovery/center-discovery.service.test.ts`
- `npx ts-node --project apps/api/tsconfig.json apps/api/src/external-discovery/external-discovery.service.test.ts`
- `npx ts-node --project apps/api/tsconfig.json apps/api/src/ntopng-observability/ntopng-observability.service.test.ts`
- `npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/network-monitor.test.ts`

Expected: All green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/external-discovery apps/api/src/ntopng-observability apps/web/app/monitoring/network/page.tsx
git commit -m "feat: correlate ntopng traffic with external findings"
```

## Self-Review

- Spec coverage:
  - `ntopng` embed in `/monitoring/network`: covered by Tasks 3 and 4.
  - separate persistence for out-of-subnet findings: covered by Tasks 1 and 2.
  - operator actions for pending findings: covered by Task 4.
  - removal of silent mock discovery behavior: covered by Task 2.
  - additive `ntopng` integration rather than replacement: covered by Tasks 3 to 5.
- Placeholder scan:
  - no `TODO`, `TBD`, or "similar to" placeholders remain.
  - all code-changing steps include concrete code.
- Type consistency:
  - `ExternalDiscoveryService.upsertScanFindings(...)`, `listByCenter(...)`, and `setStatus(...)` are defined once and reused consistently.
  - `Tráfico` tab and `ExternalFinding` types are named consistently across tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-ntopng-external-discovery-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
