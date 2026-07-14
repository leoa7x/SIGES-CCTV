import assert from "node:assert/strict";
import test from "node:test";

import { NetworkTelemetryService } from "./network-telemetry.service";

test("ingestSnapshot correlates asset samples to official assets by MAC first", async () => {
  let persistedSamples: Array<{ mac?: string; nodeAssetId?: string | null }> = [];

  const service = new NetworkTelemetryService({
    node: { findUniqueOrThrow: async () => ({ id: "node-1" }) },
    nodeAsset: { findFirst: async ({ where }: { where: { mac?: string | undefined } }) => where.mac === "AA:BB" ? ({ id: "asset-1" }) : null },
    nodeDiscoveredDevice: { findFirst: async () => null },
    networkTelemetrySnapshot: { create: async () => ({ id: "snap-1" }) },
    networkTelemetryAssetSample: {
      createMany: async ({ data }: { data: Array<{ mac?: string; nodeAssetId?: string | null }> }) => {
        persistedSamples = data;
        return { count: data.length };
      },
    },
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
  assert.equal(persistedSamples.find((sample) => sample.mac === "AA:BB")?.nodeAssetId, "asset-1");
});
