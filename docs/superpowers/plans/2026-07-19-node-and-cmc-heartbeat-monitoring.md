# Node And CMC Heartbeat Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add immediate heartbeat-based outage detection for nodes and monitoring centers, with alert creation/resolution and a real validation using the test node `192.168.1.6`.

**Architecture:** Introduce a shared reachability probe service plus lightweight schedulers that evaluate known `primaryIp` and asset IPs on a fixed interval. Persist heartbeat metadata on monitored entities, create dedicated unreachable alerts without replacing discovery or telemetry-silence alerts, and reuse the existing monitoring UI so outages show up without manual discovery.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Node timers, existing SIGES alert/monitoring APIs, Next.js admin/monitoring UI.

## Global Constraints

- Do not replace subnet discovery; heartbeat and discovery remain separate.
- Heartbeat must probe known IPs only, never CIDR ranges.
- Default heartbeat interval is `15000ms`.
- Default failure threshold is `2` consecutive failures.
- Recovery threshold is `1` successful probe.
- Telemetry silence alerts (`NODE_SILENT`, `ASSET_SILENT`) must remain independent from reachability alerts.
- Validate against the real test node `NODO-CEL-001` with `primaryIp = 192.168.1.6`.

---

### Task 1: Extend Data Model For Heartbeat State And Alert Kinds

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Test: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`

**Interfaces:**
- Consumes: existing `Node`, `MonitoringCenter`, `NodeAsset`, `CenterAsset`, `NetworkTelemetryAlert` models
- Produces:
  - new alert kinds: `NODE_UNREACHABLE`, `CENTER_UNREACHABLE`, `NODE_ASSET_UNREACHABLE`, `CENTER_ASSET_UNREACHABLE`
  - heartbeat metadata fields on monitored entities:
    - `heartbeatFailureCount Int @default(0)`
    - `lastHeartbeatAt DateTime?`
    - `lastHeartbeatAttemptAt DateTime?`

- [ ] **Step 1: Write the failing schema-facing test update**

Add assertions in `apps/api/src/network-telemetry/network-telemetry.service.test.ts` that reference the new alert kinds so the test fails until Prisma types expose them.

```ts
assert.equal(NetworkTelemetryAlertKind.NODE_UNREACHABLE, "NODE_UNREACHABLE");
assert.equal(NetworkTelemetryAlertKind.CENTER_UNREACHABLE, "CENTER_UNREACHABLE");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/network-telemetry/network-telemetry.service.test.ts`

Expected: FAIL because the enum members do not exist yet.

- [ ] **Step 3: Modify Prisma schema minimally**

Add the enum values and heartbeat fields in `apps/api/prisma/schema.prisma`.

```prisma
enum NetworkTelemetryAlertKind {
  NODE_SILENT
  ASSET_SILENT
  UNMATCHED_TRAFFIC
  NEW_DESTINATION
  NODE_UNREACHABLE
  CENTER_UNREACHABLE
  NODE_ASSET_UNREACHABLE
  CENTER_ASSET_UNREACHABLE
}
```

Add to `Node`, `MonitoringCenter`, `NodeAsset`, and `CenterAsset`:

```prisma
  heartbeatFailureCount Int       @default(0)
  lastHeartbeatAt       DateTime?
  lastHeartbeatAttemptAt DateTime?
```

- [ ] **Step 4: Regenerate Prisma client and rerun the test**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm run db:push && npm --prefix apps/api run build && npx ts-node --project apps/api/tsconfig.json apps/api/src/network-telemetry/network-telemetry.service.test.ts`

Expected: Prisma client regenerates; the enum reference no longer fails.

- [ ] **Step 5: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/api/prisma/schema.prisma apps/api/src/network-telemetry/network-telemetry.service.test.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Add heartbeat state fields and unreachable alert kinds"
```

### Task 2: Add Shared Reachability Probe Service

**Files:**
- Create: `apps/api/src/heartbeat/heartbeat-probe.service.ts`
- Create: `apps/api/src/heartbeat/heartbeat-probe.service.test.ts`
- Create: `apps/api/src/heartbeat/heartbeat.module.ts`

**Interfaces:**
- Consumes: Node runtime, available network tools
- Produces:
  - `HeartbeatProbeService.probeIp(ip: string): Promise<{ reachable: boolean; checkedAt: Date; detail: string | null }>`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/heartbeat/heartbeat-probe.service.test.ts`.

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { HeartbeatProbeService } from "./heartbeat-probe.service";

test("probeIp reports reachable false when the command result is unsuccessful", async () => {
  const service = new HeartbeatProbeService(async () => ({ code: 1, stdout: "", stderr: "timeout" }));
  const result = await service.probeIp("192.168.1.6");
  assert.equal(result.reachable, false);
  assert.equal(result.detail, "timeout");
});

test("probeIp reports reachable true when the command result is successful", async () => {
  const service = new HeartbeatProbeService(async () => ({ code: 0, stdout: "ok", stderr: "" }));
  const result = await service.probeIp("192.168.1.6");
  assert.equal(result.reachable, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/heartbeat/heartbeat-probe.service.test.ts`

Expected: FAIL because the service file does not exist.

- [ ] **Step 3: Implement the minimal service**

Create `apps/api/src/heartbeat/heartbeat-probe.service.ts`.

```ts
import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ProbeRunner = (ip: string) => Promise<{ code: number; stdout: string; stderr: string }>;

async function defaultRunner(ip: string) {
  try {
    const { stdout, stderr } = await execFileAsync("ping", ["-c", "1", "-W", "2", ip]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return { code: failure.code ?? 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? "" };
  }
}

@Injectable()
export class HeartbeatProbeService {
  constructor(private readonly runner: ProbeRunner = defaultRunner) {}

  async probeIp(ip: string) {
    const checkedAt = new Date();
    const result = await this.runner(ip);
    return {
      reachable: result.code === 0,
      checkedAt,
      detail: result.code === 0 ? null : (result.stderr.trim() || result.stdout.trim() || "unreachable"),
    };
  }
}
```

Create `apps/api/src/heartbeat/heartbeat.module.ts`.

```ts
import { Module } from "@nestjs/common";
import { HeartbeatProbeService } from "./heartbeat-probe.service";

@Module({
  providers: [HeartbeatProbeService],
  exports: [HeartbeatProbeService],
})
export class HeartbeatModule {}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/heartbeat/heartbeat-probe.service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/api/src/heartbeat/heartbeat-probe.service.ts apps/api/src/heartbeat/heartbeat-probe.service.test.ts apps/api/src/heartbeat/heartbeat.module.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Add shared heartbeat probe service"
```

### Task 3: Implement Node Heartbeat Scheduler And Alerts

**Files:**
- Create: `apps/api/src/node-discovery/node-heartbeat-scheduler.service.ts`
- Create: `apps/api/src/node-discovery/node-heartbeat-scheduler.service.test.ts`
- Modify: `apps/api/src/node-discovery/node-discovery.module.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.alerts.ts`

**Interfaces:**
- Consumes:
  - `HeartbeatProbeService.probeIp(ip)`
  - Prisma `Node` rows with heartbeat fields
- Produces:
  - `NodeHeartbeatScheduler.runCycle(): Promise<void>`
  - node state updates to `ONLINE/OFFLINE`
  - `NODE_UNREACHABLE` alerts upserted/resolved

- [ ] **Step 1: Write the failing scheduler test**

Create `apps/api/src/node-discovery/node-heartbeat-scheduler.service.test.ts`.

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NodeHeartbeatScheduler } from "./node-heartbeat-scheduler.service";

test("runCycle marks a node OFFLINE and upserts NODE_UNREACHABLE after the configured failure threshold", async () => {
  const updates: unknown[] = [];
  const alerts: unknown[] = [];
  const prisma = {
    node: {
      findMany: async () => [{ id: "node-1", primaryIp: "192.168.1.6", operativeState: "ONLINE", heartbeatFailureCount: 1 }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
    networkTelemetryAlert: {
      upsert: async (args: unknown) => { alerts.push(args); return args; },
      updateMany: async () => ({ count: 0 }),
    },
  };
  const probe = { probeIp: async () => ({ reachable: false, checkedAt: new Date(), detail: "timeout" }) };
  const scheduler = new NodeHeartbeatScheduler(prisma as never, probe as never);
  await scheduler.runCycle();
  assert.equal(updates.length, 1);
  assert.equal(alerts.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/node-discovery/node-heartbeat-scheduler.service.test.ts`

Expected: FAIL because the scheduler file does not exist.

- [ ] **Step 3: Implement the scheduler minimally**

Create `apps/api/src/node-discovery/node-heartbeat-scheduler.service.ts` with:

- `onModuleInit()` reading `HEARTBEAT_INTERVAL_MS`
- `runCycle()` querying active nodes with `primaryIp`
- one probe per node
- failure-count increment
- transition to `OFFLINE` when threshold reached
- transition back to `ONLINE` on success
- `networkTelemetryAlert.upsert()` for `NODE_UNREACHABLE`
- `networkTelemetryAlert.updateMany()` to resolve active `NODE_UNREACHABLE` on recovery

Use titles/details:

```ts
title: "Nodo principal inalcanzable"
detail: `No se pudo alcanzar ${node.primaryIp} dentro del timeout configurado.`
```

- [ ] **Step 4: Wire the scheduler into the module**

Modify `apps/api/src/node-discovery/node-discovery.module.ts`.

```ts
import { HeartbeatModule } from "../heartbeat/heartbeat.module";
import { NodeHeartbeatScheduler } from "./node-heartbeat-scheduler.service";

@Module({
  imports: [HeartbeatModule],
  controllers: [NodeDiscoveryController],
  providers: [NodeDiscoveryService, NodeHeartbeatScheduler],
})
```

- [ ] **Step 5: Run the scheduler test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/node-discovery/node-heartbeat-scheduler.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/api/src/node-discovery/node-heartbeat-scheduler.service.ts apps/api/src/node-discovery/node-heartbeat-scheduler.service.test.ts apps/api/src/node-discovery/node-discovery.module.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Add node heartbeat scheduler"
```

### Task 4: Implement CMC Heartbeat Scheduler And Center Alerts

**Files:**
- Create: `apps/api/src/center-discovery/center-heartbeat-scheduler.service.test.ts`
- Modify: `apps/api/src/center-discovery/center-discovery-scheduler.service.ts`
- Modify: `apps/api/src/center-discovery/center-discovery.module.ts`

**Interfaces:**
- Consumes:
  - `HeartbeatProbeService.probeIp(ip)`
  - Prisma `MonitoringCenter` rows with heartbeat fields
- Produces:
  - scheduler cycle for CMC primary IPs
  - center `state` / `operativeState` equivalent update path
  - `CENTER_UNREACHABLE` alerts

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/center-discovery/center-heartbeat-scheduler.service.test.ts`.

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { CenterDiscoveryScheduler } from "./center-discovery-scheduler.service";

test("runCycle marks a center outage alert after repeated heartbeat failures", async () => {
  const alerts: unknown[] = [];
  const updates: unknown[] = [];
  const prisma = {
    monitoringCenter: {
      findMany: async () => [{ id: "center-1", primaryIp: "192.168.1.1", heartbeatFailureCount: 1, state: "ACTIVE" }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
    networkTelemetryAlert: {
      upsert: async (args: unknown) => { alerts.push(args); return args; },
      updateMany: async () => ({ count: 0 }),
    },
  };
  const centerDiscovery = { runForCenter: async () => undefined };
  const probe = { probeIp: async () => ({ reachable: false, checkedAt: new Date(), detail: "timeout" }) };
  const scheduler = new CenterDiscoveryScheduler(prisma as never, centerDiscovery as never, probe as never);
  await scheduler.runCycle();
  assert.equal(alerts.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/center-discovery/center-heartbeat-scheduler.service.test.ts`

Expected: FAIL because the constructor and scheduler behavior do not yet support heartbeats.

- [ ] **Step 3: Extend the existing center scheduler**

Modify `apps/api/src/center-discovery/center-discovery-scheduler.service.ts` so it:

- injects `HeartbeatProbeService`
- separately probes `MonitoringCenter.primaryIp`
- increments/reset heartbeat counters
- creates/resolves `CENTER_UNREACHABLE`
- only calls full `runForCenter()` on the slower discovery cadence already controlled by `CENTER_MONITORING_INTERVAL_MS`

Keep heartbeat and discovery as distinct code paths inside the scheduler.

- [ ] **Step 4: Wire any module changes**

Modify `apps/api/src/center-discovery/center-discovery.module.ts` to import `HeartbeatModule` if needed.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/center-discovery/center-heartbeat-scheduler.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/api/src/center-discovery/center-discovery-scheduler.service.ts apps/api/src/center-discovery/center-heartbeat-scheduler.service.test.ts apps/api/src/center-discovery/center-discovery.module.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Add heartbeat monitoring for monitoring centers"
```

### Task 5: Add Asset-Level Heartbeat For NodeAsset And CenterAsset

**Files:**
- Create: `apps/api/src/heartbeat/asset-heartbeat.service.ts`
- Create: `apps/api/src/heartbeat/asset-heartbeat.service.test.ts`
- Modify: `apps/api/src/heartbeat/heartbeat.module.ts`

**Interfaces:**
- Consumes:
  - `HeartbeatProbeService.probeIp(ip)`
  - Prisma `NodeAsset` and `CenterAsset`
- Produces:
  - `AssetHeartbeatService.runNodeAssetCycle(): Promise<void>`
  - `AssetHeartbeatService.runCenterAssetCycle(): Promise<void>`
  - `NODE_ASSET_UNREACHABLE` and `CENTER_ASSET_UNREACHABLE` alerts

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/heartbeat/asset-heartbeat.service.test.ts`.

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { AssetHeartbeatService } from "./asset-heartbeat.service";

test("runNodeAssetCycle marks a node asset OFFLINE after repeated failures", async () => {
  const updates: unknown[] = [];
  const prisma = {
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", nodeId: "node-1", ip: "192.168.1.20", operativeState: "ONLINE", heartbeatFailureCount: 1 }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
    networkTelemetryAlert: {
      upsert: async () => ({ id: "alert-1" }),
      updateMany: async () => ({ count: 0 }),
    },
  };
  const probe = { probeIp: async () => ({ reachable: false, checkedAt: new Date(), detail: "timeout" }) };
  const service = new AssetHeartbeatService(prisma as never, probe as never);
  await service.runNodeAssetCycle();
  assert.equal(updates.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/heartbeat/asset-heartbeat.service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the minimal service**

Create `apps/api/src/heartbeat/asset-heartbeat.service.ts` with:

- `runNodeAssetCycle()`
- `runCenterAssetCycle()`
- OFFLINE/ONLINE transitions using heartbeat counters
- alert upserts/resolutions with titles:

```ts
"Activo del nodo inalcanzable"
"Activo del CMC inalcanzable"
```

- [ ] **Step 4: Export it from the heartbeat module**

Modify `apps/api/src/heartbeat/heartbeat.module.ts`.

```ts
providers: [HeartbeatProbeService, AssetHeartbeatService],
exports: [HeartbeatProbeService, AssetHeartbeatService],
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/api/tsconfig.json apps/api/src/heartbeat/asset-heartbeat.service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/api/src/heartbeat/asset-heartbeat.service.ts apps/api/src/heartbeat/asset-heartbeat.service.test.ts apps/api/src/heartbeat/heartbeat.module.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Add asset-level heartbeat monitoring"
```

### Task 6: Surface Unreachable Alerts In Monitoring UI

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/presentation.test.ts`

**Interfaces:**
- Consumes:
  - existing `/network-telemetry/nodes/:id/alerts`
  - node `operativeState`
  - new alert kinds already persisted by backend
- Produces:
  - unreachable alerts shown distinctly in monitoring tabs and summary cards

- [ ] **Step 1: Write the failing UI-oriented test**

Extend `apps/web/lib/presentation.test.ts` with a small mapping test for the new alert labels.

```ts
test("formats unreachable alert kinds for operator-facing labels", () => {
  assert.equal(formatAlertKind("NODE_UNREACHABLE"), "Nodo inalcanzable");
  assert.equal(formatAlertKind("CENTER_UNREACHABLE"), "CMC inalcanzable");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/presentation.test.ts`

Expected: FAIL because the mapping does not exist yet.

- [ ] **Step 3: Implement the minimal UI mapping and rendering adjustments**

Modify the existing presentation/helper code used by `apps/web/app/monitoring/network/page.tsx` so:

- `NODE_UNREACHABLE` renders as a critical outage
- `CENTER_UNREACHABLE` renders as a critical outage
- asset unreachable alerts render as warnings or critical based on the chosen severity from backend

Update `page.tsx` only where it consumes the alert labels/styles, without redesigning the page.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add apps/web/app/monitoring/network/page.tsx apps/web/lib/presentation.test.ts
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Show heartbeat outage alerts in monitoring UI"
```

### Task 7: Real Validation With The Cellphone Node

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-node-and-cmc-heartbeat-monitoring-design.md` (append observed validation notes only if useful)

**Interfaces:**
- Consumes:
  - node `1eca276d-9451-4673-84af-9ad89a232e7f`
  - API on `http://127.0.0.1:4001`
- Produces:
  - verified outage timing and recovery evidence

- [ ] **Step 1: Build and restart the API with heartbeat enabled**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
docker compose -f docker-compose.yml up -d --build api
```

Expected: `siges-api` starts cleanly.

- [ ] **Step 2: Verify the node is currently reachable**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
LOGIN=$(curl -s -X POST http://127.0.0.1:4001/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sigescctv.co","password":"Admin1234!"}')
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
curl -s http://127.0.0.1:4001/nodes -H "Authorization: Bearer $TOKEN"
```

Expected: `NODO-CEL-001` appears `ONLINE`.

- [ ] **Step 3: Turn off Wi-Fi on the cellphone and wait for two cycles**

Manual action: disable Wi‑Fi for the device at `192.168.1.6`, then wait `30-40s`.

Expected: enough time for two failed heartbeats.

- [ ] **Step 4: Verify offline state and alert**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
LOGIN=$(curl -s -X POST http://127.0.0.1:4001/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@sigescctv.co","password":"Admin1234!"}')
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
curl -s http://127.0.0.1:4001/nodes -H "Authorization: Bearer $TOKEN"
curl -s http://127.0.0.1:4001/network-telemetry/nodes/1eca276d-9451-4673-84af-9ad89a232e7f/alerts -H "Authorization: Bearer $TOKEN"
```

Expected:

- node state is `OFFLINE`
- active `NODE_UNREACHABLE` alert exists

- [ ] **Step 5: Turn Wi-Fi back on and verify recovery**

Manual action: re-enable Wi‑Fi, wait one cycle, then rerun the commands from Step 4.

Expected:

- node returns to `ONLINE`
- `NODE_UNREACHABLE` resolves

- [ ] **Step 6: Commit any last validation-note doc updates**

```bash
git -C /home/ingleonardosanchez/SIGES-CCTV add docs/superpowers/specs/2026-07-19-node-and-cmc-heartbeat-monitoring-design.md
git -C /home/ingleonardosanchez/SIGES-CCTV commit -m "Document heartbeat validation results"
```

## Self-Review

- Spec coverage:
  - heartbeat on node primary IP: covered by Task 3
  - heartbeat on CMC primary IP: covered by Task 4
  - heartbeat on child assets: covered by Task 5
  - unreachable alerts distinct from telemetry silence: covered by Tasks 1, 3, 4, 5, 6
  - real validation with the cellphone node: covered by Task 7
- Placeholder scan:
  - no TBD/TODO placeholders remain
  - every task includes concrete files, code direction, commands, and expected outcomes
- Type consistency:
  - shared probe interface defined in Task 2 and reused downstream
  - alert kinds named consistently across schema, scheduler, and UI tasks

Plan complete and saved to `docs/superpowers/plans/2026-07-19-node-and-cmc-heartbeat-monitoring.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
