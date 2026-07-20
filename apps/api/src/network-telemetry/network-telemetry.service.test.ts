import assert from "node:assert/strict";
import test from "node:test";
import { NetworkTelemetryAlertKind } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { NetworkTelemetryService } from "./network-telemetry.service";

test("heartbeat alert enums stay exposed through Prisma types", () => {
  assert.equal(NetworkTelemetryAlertKind.NODE_SILENT, "NODE_SILENT");
});

const baseDto = {
  nodeId: "node-1",
  collectorId: "sensor-a",
  capturedAt: "2026-07-13T20:01:00.000Z",
  windowSeconds: 60,
  totals: { bytesIn: 10, bytesOut: 20, activeHosts: 1, activeFlows: 2 },
  protocols: [],
  destinations: [],
};

function createService(overrides: Record<string, unknown> = {}) {
  const persistedSamples: Array<{ ip?: string; mac?: string; nodeAssetId?: string | null; classificationSource?: string }> = [];
  const upserts: unknown[] = [];
  const calls = { official: [] as unknown[], discovery: [] as unknown[], transactions: 0 };

  const prisma = {
    node: {
      findUnique: async () => ({ id: "node-1" }),
      findUniqueOrThrow: async () => ({ id: "node-1" }),
      findFirst: async () => null,
    },
    centerAsset: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    monitoringCenter: {
      findFirst: async () => null,
    },
    nodeAsset: {
      findFirst: async (args: unknown) => {
        calls.official.push(args);
        return null;
      },
    },
    nodeDiscoveredDevice: {
      findFirst: async (args: unknown) => {
        calls.discovery.push(args);
        return null;
      },
    },
    networkTelemetrySnapshot: { create: async () => ({ id: "snap-1" }) },
    networkTelemetryAssetSample: {
      createMany: async ({ data }: { data: typeof persistedSamples }) => {
        persistedSamples.push(...data);
        return { count: data.length };
      },
    },
    networkTelemetryAlert: {
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
    },
    operationalAlert: {
      findMany: async () => [],
      count: async () => 0,
    },
    $transaction: async <T>(callback: (transaction: unknown) => Promise<T>) => {
      calls.transactions += 1;
      return callback(prisma);
    },
    ...overrides,
  };

  return { service: new NetworkTelemetryService(prisma as unknown as PrismaService), persistedSamples, upserts, calls };
}

test("getCenterOfficialAssets returns ordered official CMC inventory", async () => {
  const officialAssets = [
    { id: "asset-1", name: "Core Switch", assetType: "SWITCH", operativeState: "ONLINE" },
  ];
  const centerAssetCalls: unknown[] = [];
  const { service } = createService({
    centerAsset: {
      findMany: async (args: unknown) => {
        centerAssetCalls.push(args);
        return officialAssets;
      },
    },
  });

  const result = await service.getCenterOfficialAssets("center-1");

  assert.deepEqual(result, officialAssets);
  assert.deepEqual(centerAssetCalls, [{
    where: { centerId: "center-1" },
    orderBy: [{ assetType: "asc" }, { name: "asc" }],
  }]);
});

test("ingestSnapshot correlates asset samples to official assets by MAC first", async () => {
  const { service, persistedSamples, calls } = createService({
    nodeAsset: {
      findFirst: async ({ where }: { where: { mac?: string } }) => where.mac === "AA:BB" ? ({ id: "asset-1" }) : null,
    },
  });

  const result = await service.ingestSnapshot({
    ...baseDto,
    assets: [{ mac: "AA:BB", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(result.snapshotId, "snap-1");
  assert.equal(persistedSamples[0]?.nodeAssetId, "asset-1");
  assert.equal(calls.discovery.length, 0);
});

test("ingestSnapshot persists snapshot data inside a transaction", async () => {
  const { service, calls } = createService();

  await service.ingestSnapshot({
    ...baseDto,
    assets: [],
  });

  assert.equal(calls.transactions, 1);
});

test("ingestSnapshot falls back to an official IP match when the MAC does not match", async () => {
  const officialCalls: unknown[] = [];
  const { service, persistedSamples, calls } = createService({
    nodeAsset: {
      findFirst: async (args: { where: { mac?: string; ip?: string } }) => {
        officialCalls.push(args);
        return args.where.ip === "10.0.0.8" ? ({ id: "asset-ip" }) : null;
      },
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ mac: "AA:BB", ip: "10.0.0.8", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.nodeAssetId, "asset-ip");
  assert.equal(persistedSamples[0]?.classificationSource, "OFFICIAL");
  assert.deepEqual(officialCalls, [
    { where: { mac: "AA:BB" } },
    { where: { ip: "10.0.0.8" } },
  ]);
  assert.equal(calls.discovery.length, 0);
});

test("ingestSnapshot detects foreign official node ownership by MAC without discovery fallback", async () => {
  const { service, persistedSamples, calls } = createService({
    nodeAsset: {
      findFirst: async ({ where }: { where: { nodeId?: string; mac?: string } }) =>
        where.mac === "AA:CC" && !where.nodeId ? ({ id: "foreign-mac-asset", nodeId: "node-foreign" }) : null,
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ mac: "AA:CC", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.nodeAssetId, null);
  assert.equal(persistedSamples[0]?.classificationSource, "UNMATCHED");
  assert.equal(calls.discovery.length, 0);
});

test("ingestSnapshot detects foreign official node ownership by IP without discovery fallback", async () => {
  const { service, persistedSamples, calls } = createService({
    nodeAsset: {
      findFirst: async ({ where }: { where: { nodeId?: string; ip?: string } }) =>
        where.ip === "10.0.0.18" && !where.nodeId ? ({ id: "foreign-ip-asset", nodeId: "node-foreign" }) : null,
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ ip: "10.0.0.18", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.nodeAssetId, null);
  assert.equal(persistedSamples[0]?.classificationSource, "UNMATCHED");
  assert.equal(calls.discovery.length, 0);
});

test("ingestSnapshot detects foreign official node ownership by primary IP without discovery fallback", async () => {
  const { service, persistedSamples, calls } = createService({
    node: {
      findUnique: async () => ({ id: "node-1" }),
      findUniqueOrThrow: async () => ({ id: "node-1" }),
      findFirst: async ({ where }: { where: { id?: string; primaryIp?: string } }) =>
        where.primaryIp === "10.0.0.28" && !where.id ? ({ id: "node-foreign" }) : null,
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ ip: "10.0.0.28", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.nodeAssetId, null);
  assert.equal(persistedSamples[0]?.classificationSource, "UNMATCHED");
  assert.equal(calls.discovery.length, 0);
});

test("ingestSnapshot prioritizes recent discovery MAC before discovery IP", async () => {
  const discoveryCalls: unknown[] = [];
  const { service, persistedSamples } = createService({
    nodeDiscoveredDevice: {
      findFirst: async (args: { where: { mac?: string; ip?: string } }) => {
        discoveryCalls.push(args);
        return args.where.mac === "AA:BB" ? ({ id: "discovered-1" }) : null;
      },
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ mac: "AA:BB", ip: "10.0.0.8", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.nodeAssetId, null);
  assert.equal(persistedSamples[0]?.classificationSource, "DISCOVERY");
  assert.deepEqual(discoveryCalls, [{
    where: {
      mac: "AA:BB",
      createdAt: { gte: new Date("2026-07-12T20:01:00.000Z") },
      nodeDiscoveryJob: { nodeId: "node-1" },
    },
    orderBy: { createdAt: "desc" },
  }]);
});

test("ingestSnapshot ignores stale discovery MAC records", async () => {
  const { service, persistedSamples } = createService({
    nodeDiscoveredDevice: {
      findFirst: async ({ where }: { where: { createdAt?: { gte: Date } } }) =>
        where.createdAt?.gte.getTime() === new Date("2026-07-12T20:01:00.000Z").getTime()
          ? null
          : ({ id: "stale-discovered-mac" }),
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ mac: "AA:BB", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.classificationSource, "UNMATCHED");
});

test("ingestSnapshot ignores stale discovery IP records", async () => {
  const { service, persistedSamples } = createService({
    nodeDiscoveredDevice: {
      findFirst: async ({ where }: { where: { createdAt?: { gte: Date } } }) =>
        where.createdAt?.gte.getTime() === new Date("2026-07-12T20:01:00.000Z").getTime()
          ? null
          : ({ id: "stale-discovered-ip" }),
    },
  });

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ ip: "10.0.0.8", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(persistedSamples[0]?.classificationSource, "UNMATCHED");
});

test("ingestSnapshot creates an unmatched traffic alert", async () => {
  const { service, upserts } = createService();

  const result = await service.ingestSnapshot({
    ...baseDto,
    assets: [{ ip: "10.0.0.9", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(result.alertsUpserted, 1);
  assert.equal(upserts.length, 1);
});

test("ingestSnapshot upserts unmatched alerts with the Prisma compound selector", async () => {
  const { service, upserts } = createService();

  await service.ingestSnapshot({
    ...baseDto,
    assets: [{ ip: "10.0.0.9", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.deepEqual(upserts[0], {
    where: {
      nodeId_kind_title: {
        nodeId: "node-1",
        kind: "UNMATCHED_TRAFFIC",
        title: "Tráfico no correlacionado 10.0.0.9",
      },
    },
    create: {
      nodeId: "node-1",
      kind: "UNMATCHED_TRAFFIC",
      severity: "INFO",
      title: "Tráfico no correlacionado 10.0.0.9",
      detail: "Se detectó tráfico de un host sin correlación con activos oficiales ni discovery reciente.",
      firstSeenAt: new Date("2026-07-13T20:01:00.000Z"),
      lastSeenAt: new Date("2026-07-13T20:01:00.000Z"),
      isActive: true,
    },
    update: {
      lastSeenAt: new Date("2026-07-13T20:01:00.000Z"),
      isActive: true,
      resolvedAt: null,
    },
  });
});

test("getNodeTimeseries serializes byte counters", async () => {
  const { service } = createService({
    networkTelemetrySnapshot: {
      findMany: async () => [{
        capturedAt: new Date("2026-07-13T20:01:00.000Z"),
        totalBytesIn: 123n,
        totalBytesOut: 456n,
        activeHosts: 1,
        activeFlows: 2,
      }],
    },
  });

  const result = await service.getNodeTimeseries("node-1");

  assert.equal(result[0]?.totalBytesIn, "123");
  assert.equal(result[0]?.totalBytesOut, "456");
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("getNodeAssets serializes byte counters", async () => {
  const { service } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1" }),
    },
    networkTelemetryAssetSample: {
      findMany: async () => [{
        id: "sample-1",
        bytesIn: 789n,
        bytesOut: 987n,
        nodeAsset: { id: "asset-1" },
      }],
    },
  });

  const result = await service.getNodeAssets("node-1");

  assert.equal(result[0]?.bytesIn, "789");
  assert.equal(result[0]?.bytesOut, "987");
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("getNodeSummary and getNodeAlerts tolerate unknown node IDs without deriving alerts", async () => {
  let upsertCalls = 0;
  const { service } = createService({
    node: { findUnique: async () => null },
    networkTelemetrySnapshot: { findFirst: async () => null },
    networkTelemetryAlert: {
      count: async () => 0,
      findMany: async () => [],
      upsert: async () => {
        upsertCalls += 1;
        throw new Error("Foreign key constraint failed");
      },
    },
  });

  const summary = await service.getNodeSummary("missing-node");
  const alerts = await service.getNodeAlerts("missing-node");

  assert.deepEqual(summary, {
    snapshotId: null,
    capturedAt: null,
    totalBytesIn: "0",
    totalBytesOut: "0",
    activeHosts: 0,
    activeFlows: 0,
    alertCount: 0,
    topProtocols: [],
    topDestinations: [],
  });
  assert.deepEqual(alerts, []);
  assert.equal(upsertCalls, 0);
});

test("getNodeSummary upserts NODE_SILENT when the latest snapshot is missing", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: { findFirst: async () => null },
    nodeAsset: { findMany: async () => [] },
    networkTelemetryAssetSample: { findMany: async () => [] },
    networkTelemetryAlert: {
      count: async () => 1,
      updateMany: async () => ({ count: 0 }),
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
    },
  });

  await service.getNodeSummary("node-1");

  assert.equal(upserts.length, 1);
  const alert = upserts[0] as { where: { nodeId_kind_title: { kind: string; title: string } }; create: { severity: string; detail: string; firstSeenAt: Date }; update: { isActive: boolean; resolvedAt: null } };
  assert.equal(alert.where.nodeId_kind_title.kind, "NODE_SILENT");
  assert.equal(alert.where.nodeId_kind_title.title, "Nodo sin snapshots recientes");
  assert.equal(alert.create.severity, "CRITICAL");
  assert.equal(alert.create.detail, "No se recibió telemetría reciente para el nodo dentro de la ventana esperada.");
  assert.ok(alert.create.firstSeenAt instanceof Date);
  assert.deepEqual(alert.update, { isActive: true, resolvedAt: null, lastSeenAt: alert.create.firstSeenAt });
});

test("getNodeSummary derives ASSET_SILENT for an official asset without a recent sample", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", name: "Camara norte" }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
    },
  });

  await service.getNodeSummary("node-1");

  assert.equal(upserts.length, 1);
  const alert = upserts[0] as { where: { nodeId_kind_title: { kind: string; title: string } } };
  assert.deepEqual(alert.where.nodeId_kind_title, {
    nodeId: "node-1",
    kind: "ASSET_SILENT",
    title: "Activo sin telemetría reciente asset-1",
  });
});

test("getNodeAlerts includes NODE_SILENT when no recent snapshot exists", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: { findFirst: async () => null },
    nodeAsset: { findMany: async () => [] },
    networkTelemetryAssetSample: { findMany: async () => [] },
    networkTelemetryAlert: {
      findMany: async () => [{ kind: "NODE_SILENT" }],
      updateMany: async () => ({ count: 0 }),
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
    },
  });

  const result = await service.getNodeAlerts("node-1");

  assert.equal(result[0]?.kind, "NODE_SILENT");
  assert.equal(upserts.length, 1);
});

test("getNodeAlerts upserts NODE_SILENT and ASSET_SILENT during a node-wide outage", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date(0) }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", name: "Camara norte" }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      findMany: async () => [],
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
      updateMany: async () => ({ count: 0 }),
    },
  });

  await service.getNodeAlerts("node-1");

  assert.deepEqual(
    upserts.map((alert) => (alert as { where: { nodeId_kind_title: { kind: string } } }).where.nodeId_kind_title.kind),
    ["NODE_SILENT", "ASSET_SILENT"],
  );
});

test("getNodeSummary resolves an active NODE_SILENT alert when telemetry resumes", async () => {
  const resolutions: unknown[] = [];
  const { service } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      count: async () => 0,
      updateMany: async (args: unknown) => {
        resolutions.push(args);
        return { count: 1 };
      },
    },
  });

  await service.getNodeSummary("node-1");

  assert.equal(resolutions.length, 2);
  const resolution = resolutions[0] as { where: { nodeId: string; kind: string; isActive: boolean }; data: { isActive: boolean; resolvedAt: Date } };
  assert.deepEqual(resolution.where, { nodeId: "node-1", kind: "NODE_SILENT", isActive: true });
  assert.equal(resolution.data.isActive, false);
  assert.ok(resolution.data.resolvedAt instanceof Date);
});

test("getNodeAlerts upserts ASSET_SILENT for an official asset without a recent sample", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", name: "Camara norte" }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      findMany: async () => [{ kind: "ASSET_SILENT" }],
      upsert: async (args: unknown) => {
        upserts.push(args);
        return { id: "alert-1" };
      },
      updateMany: async () => ({ count: 0 }),
    },
  });

  const result = await service.getNodeAlerts("node-1");

  assert.equal(result[0]?.kind, "ASSET_SILENT");
  assert.equal(upserts.length, 1);
  const alert = upserts[0] as { where: { nodeId_kind_title: { kind: string; title: string } }; create: { nodeAssetId: string; severity: string; detail: string }; update: { isActive: boolean; resolvedAt: null } };
  assert.equal(alert.where.nodeId_kind_title.kind, "ASSET_SILENT");
  assert.equal(alert.where.nodeId_kind_title.title, "Activo sin telemetría reciente asset-1");
  assert.equal(alert.create.nodeAssetId, "asset-1");
  assert.equal(alert.create.severity, "WARNING");
  assert.equal(alert.create.detail, "El activo oficial no tuvo muestras de telemetría dentro de la ventana esperada.");
  assert.deepEqual(alert.update.isActive, true);
  assert.equal(alert.update.resolvedAt, null);
});

test("getNodeAlerts keeps one ASSET_SILENT alert identity when a silent asset is renamed", async () => {
  let assetName = "Camara norte";
  const activeAlertKeys = new Set<string>();
  const { service } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", name: assetName }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      upsert: async ({ where }: { where: { nodeId_kind_title: { nodeId: string; kind: string; title: string } } }) => {
        const selector = where.nodeId_kind_title;
        activeAlertKeys.add(`${selector.nodeId}:${selector.kind}:${selector.title}`);
        return { id: "alert-1" };
      },
    },
  });

  await service.getNodeAlerts("node-1");
  assetName = "Camara principal";
  await service.getNodeAlerts("node-1");

  assert.deepEqual([...activeAlertKeys], ["node-1:ASSET_SILENT:Activo sin telemetría reciente asset-1"]);
});

test("getNodeAlerts resolves an active ASSET_SILENT alert when its asset becomes visible", async () => {
  const resolutions: unknown[] = [];
  const { service } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-1", name: "Camara norte" }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [{ nodeAssetId: "asset-1" }],
    },
    networkTelemetryAlert: {
      findMany: async () => [],
      updateMany: async (args: unknown) => {
        resolutions.push(args);
        return { count: 1 };
      },
    },
  });

  await service.getNodeAlerts("node-1");

  assert.equal(resolutions.length, 3);
  const assetResolution = resolutions[1] as { where: { nodeId: string; nodeAssetId: { in: string[] }; kind: string; isActive: boolean }; data: { isActive: boolean; resolvedAt: Date } };
  assert.deepEqual(assetResolution.where, {
    nodeId: "node-1",
    nodeAssetId: { in: ["asset-1"] },
    kind: "ASSET_SILENT",
    isActive: true,
  });
  assert.equal(assetResolution.data.isActive, false);
  assert.ok(assetResolution.data.resolvedAt instanceof Date);
});

test("getNodeAlerts resolves an active ASSET_SILENT alert for an asset no longer on the node", async () => {
  const resolutions: unknown[] = [];
  const { service } = createService({
    networkTelemetrySnapshot: {
      findFirst: async () => ({ id: "snap-1", capturedAt: new Date() }),
    },
    nodeAsset: {
      findMany: async () => [{ id: "asset-current", name: "Camara norte" }],
    },
    networkTelemetryAssetSample: {
      findMany: async () => [],
    },
    networkTelemetryAlert: {
      findMany: async () => [],
      updateMany: async (args: unknown) => {
        resolutions.push(args);
        return { count: 1 };
      },
      upsert: async () => ({ id: "alert-1" }),
    },
  });

  await service.getNodeAlerts("node-1");

  assert.equal(resolutions.length, 2);
  const staleAssetResolution = resolutions[1] as {
    where: { nodeId: string; nodeAssetId: { notIn: string[] }; kind: string; isActive: boolean };
    data: { isActive: boolean; resolvedAt: Date };
  };
  assert.deepEqual(staleAssetResolution.where, {
    nodeId: "node-1",
    nodeAssetId: { notIn: ["asset-current"] },
    kind: "ASSET_SILENT",
    isActive: true,
  });
  assert.equal(staleAssetResolution.data.isActive, false);
  assert.ok(staleAssetResolution.data.resolvedAt instanceof Date);
});
