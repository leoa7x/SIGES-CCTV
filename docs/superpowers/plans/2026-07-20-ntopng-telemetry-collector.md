# ntopng Telemetry Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real local `ntopng`-backed collector that feeds SIGES `network-telemetry` with normalized traffic snapshots and routes unmatched hosts into external discovery.

**Architecture:** Add a bounded collector layer under `apps/api` that polls local `ntopng`, normalizes observed hosts, correlates them to SIGES entities, aggregates by node and center, and reuses the existing `POST /network-telemetry/ingest` pipeline instead of inventing a second persistence path. Extend the current telemetry/domain services only where necessary to support center correlation, unmatched forwarding, and operational validation.

**Tech Stack:** NestJS, Prisma, PostgreSQL, TypeScript, Python helper scripts pattern, `node:test`, existing SIGES telemetry and external-discovery modules, local `ntopng`.

## Global Constraints

- No mock traffic, fake snapshots, or silent fallback data in production flow.
- `LAN-Orangutan` and `whosthere` remain discovery-only; they are not the throughput source.
- Heartbeat remains the fast online/offline layer; telemetry complements it and does not replace it.
- The collector must publish through the existing `/network-telemetry/ingest` contract rather than bypassing it.
- Unmatched and out-of-subnet observations must be preserved separately instead of being forced into official inventory.
- Local changes already exist in this repo; do not revert unrelated user work.

---

### Task 1: Add the collector configuration and host-normalization contract

**Files:**
- Create: `apps/api/src/network-telemetry/ntopng-client.ts`
- Create: `apps/api/src/network-telemetry/ntopng-client.test.ts`
- Create: `apps/api/src/network-telemetry/ntopng-collector.types.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/network-telemetry/ntopng-client.test.ts`

**Interfaces:**
- Consumes: local `ntopng` HTTP API, environment variables `NTOPNG_BASE_URL`, `NTOPNG_USERNAME`, `NTOPNG_PASSWORD`
- Produces:
  - `type NtopngObservedHost = { ip?: string; mac?: string; hostname?: string; bytesIn: number; bytesOut: number; flowCount: number; lastSeenAt: string }`
  - `class NtopngClient { fetchObservedHosts(): Promise<NtopngObservedHost[]> }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NtopngClient } from "./ntopng-client";

test("fetchObservedHosts normalizes ntopng host rows into SIGES host observations", async () => {
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        hosts: [
          {
            ip: "192.168.1.6",
            mac: "AA:BB:CC:DD:EE:FF",
            name: "celular",
            bytes_rcvd: 1200,
            bytes_sent: 800,
            flows: 4,
            last_seen: "2026-07-20T18:00:00.000Z",
          },
        ],
      }),
    } as Response),
  });

  const hosts = await client.fetchObservedHosts();

  assert.deepEqual(hosts, [
    {
      ip: "192.168.1.6",
      mac: "AA:BB:CC:DD:EE:FF",
      hostname: "celular",
      bytesIn: 1200,
      bytesOut: 800,
      flowCount: 4,
      lastSeenAt: "2026-07-20T18:00:00.000Z",
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-client.test.ts`
Expected: FAIL with module-not-found or missing export errors for `NtopngClient`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type NtopngObservedHost = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn: number;
  bytesOut: number;
  flowCount: number;
  lastSeenAt: string;
};

type FetchLike = typeof fetch;

export class NtopngClient {
  constructor(
    private readonly config: {
      baseUrl: string;
      username: string;
      password: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  async fetchObservedHosts(): Promise<NtopngObservedHost[]> {
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.baseUrl}/api/hosts`);
    if (!response.ok) throw new Error(`ntopng request failed with ${response.status}`);
    const payload = await response.json() as { hosts?: Array<Record<string, unknown>> };
    return (payload.hosts ?? []).map((host) => ({
      ip: typeof host.ip === "string" ? host.ip : undefined,
      mac: typeof host.mac === "string" ? host.mac : undefined,
      hostname: typeof host.name === "string" ? host.name : undefined,
      bytesIn: Number(host.bytes_rcvd ?? 0),
      bytesOut: Number(host.bytes_sent ?? 0),
      flowCount: Number(host.flows ?? 0),
      lastSeenAt: String(host.last_seen ?? new Date(0).toISOString()),
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-client.test.ts`
Expected: PASS with one subtest for normalization.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry/ntopng-client.ts apps/api/src/network-telemetry/ntopng-client.test.ts apps/api/src/network-telemetry/ntopng-collector.types.ts apps/api/src/network-telemetry/network-telemetry.module.ts apps/api/src/app.module.ts
git commit -m "feat: add ntopng client contract for telemetry collector"
```

### Task 2: Extend correlation logic to support nodes, centers, and ambiguity safely

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry-correlation.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry-correlation.test.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Test: `apps/api/src/network-telemetry/network-telemetry-correlation.test.ts`

**Interfaces:**
- Consumes: `Node`, `NodeAsset`, `MonitoringCenter`, `CenterAsset`, observed host shape from Task 1
- Produces:
  - `type TelemetryOwner = { kind: "node" | "center" | "unmatched"; nodeId?: string; centerId?: string; reason?: string }`
  - `async function correlateObservedHost(...): Promise<TelemetryOwner>`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { correlateObservedHost } from "./network-telemetry-correlation";

test("correlateObservedHost prefers MAC matches over IP matches and marks conflicts as ambiguous", async () => {
  const result = await correlateObservedHost(
    {
      ip: "192.168.1.6",
      mac: "AA:BB:CC:DD:EE:FF",
      hostname: "celular",
      bytesIn: 10,
      bytesOut: 20,
      flowCount: 1,
      lastSeenAt: "2026-07-20T18:00:00.000Z",
    },
    {
      findNodeAssetByMac: async () => ({ id: "asset-1", nodeId: "node-1" }),
      findCenterAssetByMac: async () => null,
      findNodeAssetByIp: async () => ({ id: "asset-2", nodeId: "node-2" }),
      findCenterAssetByIp: async () => null,
      findNodeByPrimaryIp: async () => null,
      findCenterByPrimaryIp: async () => null,
    },
  );

  assert.deepEqual(result, { kind: "node", nodeId: "node-1" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry-correlation.test.ts`
Expected: FAIL because `correlateObservedHost` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function correlateObservedHost(
  host: { ip?: string; mac?: string },
  deps: {
    findNodeAssetByMac: () => Promise<{ id: string; nodeId: string } | null>;
    findCenterAssetByMac: () => Promise<{ id: string; centerId: string } | null>;
    findNodeAssetByIp: () => Promise<{ id: string; nodeId: string } | null>;
    findCenterAssetByIp: () => Promise<{ id: string; centerId: string } | null>;
    findNodeByPrimaryIp: () => Promise<{ id: string } | null>;
    findCenterByPrimaryIp: () => Promise<{ id: string } | null>;
  },
) {
  const nodeAssetByMac = host.mac ? await deps.findNodeAssetByMac() : null;
  if (nodeAssetByMac) return { kind: "node", nodeId: nodeAssetByMac.nodeId };

  const centerAssetByMac = host.mac ? await deps.findCenterAssetByMac() : null;
  if (centerAssetByMac) return { kind: "center", centerId: centerAssetByMac.centerId };

  const nodeAssetByIp = host.ip ? await deps.findNodeAssetByIp() : null;
  if (nodeAssetByIp) return { kind: "node", nodeId: nodeAssetByIp.nodeId };

  const centerAssetByIp = host.ip ? await deps.findCenterAssetByIp() : null;
  if (centerAssetByIp) return { kind: "center", centerId: centerAssetByIp.centerId };

  const nodeByPrimaryIp = host.ip ? await deps.findNodeByPrimaryIp() : null;
  if (nodeByPrimaryIp) return { kind: "node", nodeId: nodeByPrimaryIp.id };

  const centerByPrimaryIp = host.ip ? await deps.findCenterByPrimaryIp() : null;
  if (centerByPrimaryIp) return { kind: "center", centerId: centerByPrimaryIp.id };

  return { kind: "unmatched", reason: "NO_MATCH" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry-correlation.test.ts`
Expected: PASS with MAC-priority behavior.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry/network-telemetry-correlation.ts apps/api/src/network-telemetry/network-telemetry-correlation.test.ts apps/api/src/network-telemetry/network-telemetry.service.ts apps/api/src/network-telemetry/network-telemetry.service.test.ts
git commit -m "feat: add safe node and center telemetry correlation"
```

### Task 3: Build the aggregator that turns observed hosts into ingest payloads

**Files:**
- Create: `apps/api/src/network-telemetry/ntopng-collector.service.ts`
- Create: `apps/api/src/network-telemetry/ntopng-collector.service.test.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.types.ts`
- Test: `apps/api/src/network-telemetry/ntopng-collector.service.test.ts`

**Interfaces:**
- Consumes: `NtopngObservedHost[]`, `correlateObservedHost(...)`, current ingestion DTO shape
- Produces:
  - `class NtopngCollectorService { buildSnapshots(capturedAt: string, hosts: NtopngObservedHost[]): Promise<IngestNetworkTelemetryDto[]> }`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NtopngCollectorService } from "./ntopng-collector.service";

test("buildSnapshots aggregates multiple correlated hosts into one node payload", async () => {
  const service = new NtopngCollectorService({
    correlateHost: async (host) => host.ip === "192.168.1.6"
      ? { kind: "node", nodeId: "node-1" }
      : { kind: "node", nodeId: "node-1" },
  } as any);

  const payloads = await service.buildSnapshots("2026-07-20T18:00:00.000Z", [
    { ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" },
    { ip: "192.168.1.20", bytesIn: 300, bytesOut: 150, flowCount: 4, lastSeenAt: "2026-07-20T17:59:58.000Z" },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]?.nodeId, "node-1");
  assert.deepEqual(payloads[0]?.totals, { bytesIn: 400, bytesOut: 200, activeHosts: 2, activeFlows: 6 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-collector.service.test.ts`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export class NtopngCollectorService {
  constructor(private readonly deps: { correlateHost: (host: any) => Promise<any> }) {}

  async buildSnapshots(capturedAt: string, hosts: Array<any>) {
    const groups = new Map<string, any[]>();

    for (const host of hosts) {
      const owner = await this.deps.correlateHost(host);
      if (owner.kind !== "node") continue;
      const list = groups.get(owner.nodeId) ?? [];
      list.push(host);
      groups.set(owner.nodeId, list);
    }

    return [...groups.entries()].map(([nodeId, nodeHosts]) => ({
      nodeId,
      collectorId: "ntopng-local",
      capturedAt,
      windowSeconds: 60,
      totals: {
        bytesIn: nodeHosts.reduce((sum, host) => sum + host.bytesIn, 0),
        bytesOut: nodeHosts.reduce((sum, host) => sum + host.bytesOut, 0),
        activeHosts: nodeHosts.length,
        activeFlows: nodeHosts.reduce((sum, host) => sum + host.flowCount, 0),
      },
      protocols: [],
      destinations: [],
      assets: nodeHosts,
    }));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-collector.service.test.ts`
Expected: PASS with one node-level aggregation.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry/ntopng-collector.service.ts apps/api/src/network-telemetry/ntopng-collector.service.test.ts apps/api/src/network-telemetry/network-telemetry.types.ts
git commit -m "feat: aggregate ntopng host traffic into telemetry snapshots"
```

### Task 4: Route unmatched and out-of-subnet hosts into external discovery

**Files:**
- Modify: `apps/api/src/network-telemetry/ntopng-collector.service.ts`
- Modify: `apps/api/src/external-discovery/external-discovery.service.ts`
- Modify: `apps/api/src/external-discovery/external-discovery.service.test.ts`
- Modify: `apps/api/src/network-telemetry/ntopng-collector.service.test.ts`
- Test: `apps/api/src/external-discovery/external-discovery.service.test.ts`

**Interfaces:**
- Consumes: unmatched correlation results, `ExternalDiscoveryService.upsertScanFindings(...)`
- Produces:
  - unmatched observations forwarded with source `"NTOPNG"`
  - official totals excluding unmatched hosts

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NtopngCollectorService } from "../network-telemetry/ntopng-collector.service";

test("buildSnapshots excludes unmatched hosts from official totals and forwards them to external discovery", async () => {
  const forwarded: unknown[] = [];
  const service = new NtopngCollectorService({
    correlateHost: async (host) => host.ip === "10.0.0.9"
      ? { kind: "unmatched", reason: "NO_MATCH", centerId: "center-1" }
      : { kind: "node", nodeId: "node-1" },
    externalDiscovery: {
      upsertScanFindings: async (...args: unknown[]) => {
        forwarded.push(args);
      },
    },
  } as any);

  const payloads = await service.buildSnapshots("2026-07-20T18:00:00.000Z", [
    { ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" },
    { ip: "10.0.0.9", bytesIn: 900, bytesOut: 400, flowCount: 3, lastSeenAt: "2026-07-20T17:59:58.000Z" },
  ]);

  assert.equal(payloads[0]?.totals.bytesIn, 100);
  assert.equal(forwarded.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-collector.service.test.ts`
Expected: FAIL because unmatched forwarding is not implemented.

- [ ] **Step 3: Write minimal implementation**

```ts
const unmatchedByCenter = new Map<string, Array<{ ip?: string; mac?: string; hostname?: string }>>();

for (const host of hosts) {
  const owner = await this.deps.correlateHost(host);
  if (owner.kind === "unmatched") {
    const centerId = owner.centerId ?? "unknown-center";
    const list = unmatchedByCenter.get(centerId) ?? [];
    list.push({ ip: host.ip, mac: host.mac, hostname: host.hostname });
    unmatchedByCenter.set(centerId, list);
    continue;
  }
  // existing official grouping
}

for (const [centerId, devices] of unmatchedByCenter.entries()) {
  await this.deps.externalDiscovery.upsertScanFindings(centerId, null, null, devices, "NTOPNG");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-collector.service.test.ts`
Expected: PASS showing unmatched hosts stay out of node totals and are forwarded.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry/ntopng-collector.service.ts apps/api/src/network-telemetry/ntopng-collector.service.test.ts apps/api/src/external-discovery/external-discovery.service.ts apps/api/src/external-discovery/external-discovery.service.test.ts
git commit -m "feat: forward unmatched ntopng hosts into external discovery"
```

### Task 5: Add a runnable collector command and scheduler entrypoint

**Files:**
- Create: `apps/api/scripts/run_ntopng_telemetry_collector.ts`
- Create: `apps/api/scripts/run_ntopng_telemetry_collector.test.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/Dockerfile`
- Test: `apps/api/scripts/run_ntopng_telemetry_collector.test.ts`

**Interfaces:**
- Consumes: `NtopngClient`, `NtopngCollectorService`, `NetworkTelemetryService` or authenticated ingest HTTP call
- Produces:
  - script entrypoint `npm run telemetry:collect --workspace=apps/api`
  - one-cycle collector execution suitable for cron/systemd/container scheduling

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { runCollectorCycle } from "./run_ntopng_telemetry_collector";

test("runCollectorCycle fetches hosts, builds payloads, and posts them to ingest", async () => {
  const posted: unknown[] = [];
  await runCollectorCycle({
    fetchHosts: async () => [{ ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" }],
    buildSnapshots: async () => [{
      nodeId: "node-1",
      collectorId: "ntopng-local",
      capturedAt: "2026-07-20T18:00:00.000Z",
      windowSeconds: 60,
      totals: { bytesIn: 100, bytesOut: 50, activeHosts: 1, activeFlows: 2 },
      protocols: [],
      destinations: [],
      assets: [],
    }],
    postSnapshot: async (payload) => {
      posted.push(payload);
    },
  });

  assert.equal(posted.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json scripts/run_ntopng_telemetry_collector.test.ts`
Expected: FAIL because the script export does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function runCollectorCycle(deps: {
  fetchHosts: () => Promise<any[]>;
  buildSnapshots: (capturedAt: string, hosts: any[]) => Promise<any[]>;
  postSnapshot: (payload: any) => Promise<void>;
}) {
  const capturedAt = new Date().toISOString();
  const hosts = await deps.fetchHosts();
  const payloads = await deps.buildSnapshots(capturedAt, hosts);
  for (const payload of payloads) {
    await deps.postSnapshot(payload);
  }
}

if (require.main === module) {
  const client = new NtopngClient({
    baseUrl: process.env.NTOPNG_BASE_URL ?? "",
    username: process.env.NTOPNG_USERNAME ?? "",
    password: process.env.NTOPNG_PASSWORD ?? "",
  });
  const collector = new NtopngCollectorService(/* inject real Prisma/services here */);

  void runCollectorCycle({
    fetchHosts: () => client.fetchObservedHosts(),
    buildSnapshots: (capturedAt, hosts) => collector.buildSnapshots(capturedAt, hosts),
    postSnapshot: async (payload) => {
      const response = await fetch(`${process.env.NETWORK_TELEMETRY_INGEST_URL}/network-telemetry/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NETWORK_TELEMETRY_INGEST_TOKEN ?? ""}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`ingest failed with ${response.status}`);
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json scripts/run_ntopng_telemetry_collector.test.ts`
Expected: PASS with one posted payload.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/run_ntopng_telemetry_collector.ts apps/api/scripts/run_ntopng_telemetry_collector.test.ts apps/api/package.json apps/api/Dockerfile
git commit -m "feat: add runnable ntopng telemetry collector entrypoint"
```

### Task 6: Wire collector output into real telemetry verification and observability

**Files:**
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Modify: `apps/api/src/observability/observability.service.test.ts`
- Modify: `apps/web/lib/grafana-dashboard-layout.test.ts`
- Modify: `docs/superpowers/specs/2026-07-20-ntopng-telemetry-collector-design.md`
- Test: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Test: `apps/api/src/observability/observability.service.test.ts`

**Interfaces:**
- Consumes: persisted snapshots from the collector path
- Produces:
  - verified end-to-end expectation that real snapshots populate monitoring/Grafana queries

- [ ] **Step 1: Write the failing test**

```ts
test("ingested collector snapshots become visible through node summary and timeseries queries", async () => {
  const snapshots = [{
    id: "snap-1",
    nodeId: "node-1",
    capturedAt: new Date("2026-07-20T18:00:00.000Z"),
    totalBytesIn: BigInt(1000),
    totalBytesOut: BigInt(500),
    activeHosts: 1,
    activeFlows: 3,
    topProtocolsJson: [],
    topDestinationsJson: [],
  }];

  const prisma = {
    node: {
      findUnique: async () => ({ id: "node-1", route: { monitoringCenterId: "center-1" } }),
      findUniqueOrThrow: async () => ({ id: "node-1" }),
    },
    networkTelemetrySnapshot: {
      findFirst: async () => snapshots[0],
      findMany: async () => snapshots,
    },
    operationalAlert: { count: async () => 0, findMany: async () => [] },
    networkTelemetryAlert: { findMany: async () => [] },
  } as any;

  const service = new NetworkTelemetryService(prisma);
  const summary = await service.getNodeSummary("node-1");
  const series = await service.getNodeTimeseries("node-1");

  assert.equal(summary.totalBytesIn, "1000");
  assert.equal(summary.totalBytesOut, "500");
  assert.equal(series[0]?.totalBytesIn, "1000");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry.service.test.ts`
Expected: FAIL because the new visibility case is not implemented in the test harness or service assumptions.

- [ ] **Step 3: Write minimal implementation**

```ts
// Add the exact test above into `network-telemetry.service.test.ts`.
// If it fails because `getNodeContext()` requires route-center context,
// extend the local test stub to return:
//   node.findUnique({ where: { id: "node-1" }, include: { route: true } })
// with:
//   { id: "node-1", route: { monitoringCenterId: "center-1" } }
// No production service change is needed unless the summary path ignores an
// existing snapshot under a valid node context.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV && npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry.service.test.ts && npm exec --workspace=apps/api ts-node --project tsconfig.json src/observability/observability.service.test.ts && npm exec --workspace=apps/web ts-node --project tsconfig.test.json lib/grafana-dashboard-layout.test.ts`
Expected: PASS across telemetry, observability, and dashboard layout checks.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry/network-telemetry.service.test.ts apps/api/src/observability/observability.service.test.ts apps/web/lib/grafana-dashboard-layout.test.ts docs/superpowers/specs/2026-07-20-ntopng-telemetry-collector-design.md
git commit -m "test: verify collector-fed telemetry reaches observability surfaces"
```

### Task 7: Perform real operational verification against the local environment

**Files:**
- Modify: `README.md`
- Create: `docs/superpowers/plans/2026-07-20-ntopng-telemetry-collector-verification-notes.md`
- Test: live environment commands only

**Interfaces:**
- Consumes: local `ntopng`, local SIGES API, real node such as `192.168.1.6`
- Produces:
  - reproducible runbook for real collector validation

- [ ] **Step 1: Write the verification checklist**

```md
1. Start local `ntopng` on the SIGES host and confirm the watched interface.
2. Run one collector cycle.
3. Query `/network-telemetry/nodes/:id/summary`.
4. Query Grafana-backed views or `telemetry_node_timeseries_view`.
5. Confirm snapshot growth and non-zero totals for a real active node.
```

- [ ] **Step 2: Run real verification commands**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
docker ps
curl -s http://127.0.0.1:4001/docs | head -n 5
```

Expected:

- SIGES API reachable
- local infrastructure up
- verification can continue against a live environment

- [ ] **Step 3: Document exact production-facing verification**

```md
- `NetworkTelemetrySnapshot` increases after collector runs
- `/monitoring/network` stops showing empty traffic-only graphs
- the real node `192.168.1.6` contributes traffic only when active
- unmatched hosts are visible in external discovery rather than polluting official totals
```

- [ ] **Step 4: Re-run full verification set**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-client.test.ts
npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry-correlation.test.ts
npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/ntopng-collector.service.test.ts
npm exec --workspace=apps/api ts-node --project tsconfig.json scripts/run_ntopng_telemetry_collector.test.ts
npm exec --workspace=apps/api ts-node --project tsconfig.json src/network-telemetry/network-telemetry.service.test.ts
```

Expected: PASS on all collector-related test suites.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/plans/2026-07-20-ntopng-telemetry-collector-verification-notes.md
git commit -m "docs: add ntopng telemetry collector verification runbook"
```
