import assert from "node:assert/strict";
import test from "node:test";

import { PrismaService } from "../prisma/prisma.service";
import { NetworkTelemetryService } from "./network-telemetry.service";

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
    node: { findUniqueOrThrow: async () => ({ id: "node-1" }) },
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
    $transaction: async <T>(callback: (transaction: unknown) => Promise<T>) => {
      calls.transactions += 1;
      return callback(prisma);
    },
    ...overrides,
  };

  return { service: new NetworkTelemetryService(prisma as unknown as PrismaService), persistedSamples, upserts, calls };
}

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
    { where: { nodeId: "node-1", mac: "AA:BB" } },
    { where: { nodeId: "node-1", ip: "10.0.0.8" } },
  ]);
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

test("getNodeSummary upserts NODE_SILENT when the latest snapshot is missing", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: { findFirst: async () => null },
    networkTelemetryAlert: {
      count: async () => 1,
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

test("getNodeAlerts includes NODE_SILENT when no recent snapshot exists", async () => {
  const { service, upserts } = createService({
    networkTelemetrySnapshot: { findFirst: async () => null },
    networkTelemetryAlert: {
      findMany: async () => [{ kind: "NODE_SILENT" }],
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
    },
  });

  const result = await service.getNodeAlerts("node-1");

  assert.equal(result[0]?.kind, "ASSET_SILENT");
  assert.equal(upserts.length, 1);
  const alert = upserts[0] as { where: { nodeId_kind_title: { kind: string; title: string } }; create: { nodeAssetId: string; severity: string; detail: string }; update: { isActive: boolean; resolvedAt: null } };
  assert.equal(alert.where.nodeId_kind_title.kind, "ASSET_SILENT");
  assert.equal(alert.where.nodeId_kind_title.title, "Activo sin telemetría reciente Camara norte");
  assert.equal(alert.create.nodeAssetId, "asset-1");
  assert.equal(alert.create.severity, "WARNING");
  assert.equal(alert.create.detail, "El activo oficial no tuvo muestras de telemetría dentro de la ventana esperada.");
  assert.deepEqual(alert.update.isActive, true);
  assert.equal(alert.update.resolvedAt, null);
});
