import assert from "node:assert/strict";
import test from "node:test";

import { DataRetentionScheduler } from "./data-retention-scheduler.service";

function buildPrisma(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string, args: unknown) => {
    calls[name] ??= [];
    calls[name].push(args);
  };

  const prisma = {
    networkTelemetrySnapshot: {
      findMany: async () => [{ id: "snap-1" }, { id: "snap-2" }],
      deleteMany: async (args: unknown) => {
        record("snapshot.deleteMany", args);
        return { count: 2 };
      },
    },
    networkTelemetryAlert: {
      updateMany: async (args: unknown) => {
        record("alert.updateMany", args);
        return { count: 3 };
      },
    },
    networkTelemetryAssetSample: {
      deleteMany: async (args: unknown) => {
        record("sample.deleteMany", args);
        return { count: 7 };
      },
    },
    deviceStateLog: {
      deleteMany: async (args: unknown) => {
        record("deviceStateLog.deleteMany", args);
        return { count: 4 };
      },
    },
    centerDiscoveredDevice: {
      deleteMany: async (args: unknown) => {
        record("centerDiscoveredDevice.deleteMany", args);
        return { count: 1 };
      },
    },
    nodeDiscoveredDevice: {
      deleteMany: async (args: unknown) => {
        record("nodeDiscoveredDevice.deleteMany", args);
        return { count: 5 };
      },
    },
    ...overrides,
  };

  return { prisma, calls };
}

test("pruneStale computes a cutoff 90 days back by default and deletes/decouples accordingly", async () => {
  const { prisma, calls } = buildPrisma();
  const scheduler = new DataRetentionScheduler(prisma as never);

  const now = new Date("2026-07-20T00:00:00.000Z");
  const counts = await scheduler.pruneStale(now);

  const expectedCutoff = new Date("2026-04-21T00:00:00.000Z"); // 90 days before

  assert.deepEqual(
    (calls["snapshot.deleteMany"][0] as { where: { capturedAt: { lt: Date } } }).where.capturedAt.lt,
    expectedCutoff,
  );
  assert.deepEqual(
    (calls["alert.updateMany"][0] as { where: { snapshotId: { in: string[] } }; data: { snapshotId: null } }),
    { where: { snapshotId: { in: ["snap-1", "snap-2"] } }, data: { snapshotId: null } },
  );
  assert.deepEqual(
    (calls["sample.deleteMany"][0] as { where: { snapshotId: { in: string[] } } }).where.snapshotId.in,
    ["snap-1", "snap-2"],
  );

  assert.deepEqual(counts, {
    telemetrySnapshots: 2,
    telemetryAssetSamples: 7,
    deviceStateLogs: 4,
    centerDiscoveredDevices: 1,
    nodeDiscoveredDevices: 5,
  });
});

test("pruneStale skips the alert decouple step when there are no stale snapshots", async () => {
  const { prisma, calls } = buildPrisma({
    networkTelemetrySnapshot: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
  });
  const scheduler = new DataRetentionScheduler(prisma as never);

  await scheduler.pruneStale(new Date("2026-07-20T00:00:00.000Z"));

  assert.equal(calls["alert.updateMany"], undefined);
});

test("runCycle does not overlap a run already in progress", async () => {
  let concurrentCalls = 0;
  let maxConcurrent = 0;

  const { prisma } = buildPrisma({
    networkTelemetrySnapshot: {
      findMany: async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);
        await new Promise((resolve) => setTimeout(resolve, 10));
        concurrentCalls--;
        return [];
      },
      deleteMany: async () => ({ count: 0 }),
    },
  });

  const scheduler = new DataRetentionScheduler(prisma as never);
  await Promise.all([scheduler.runCycle(), scheduler.runCycle()]);

  assert.equal(maxConcurrent, 1);
});
