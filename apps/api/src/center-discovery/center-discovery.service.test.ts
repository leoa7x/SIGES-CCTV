import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

import { CenterDiscoveryService } from "./center-discovery.service";

test("confirmDevice merges by MAC before creating a new CenterAsset", async () => {
  let updatedAssetId = "";
  let deviceStatus = "";
  const findFirstCalls: Record<string, unknown>[] = [];
  let updatedPayload: Record<string, unknown> | null = null;

  const prisma = {
    centerDiscoveredDevice: {
      findUniqueOrThrow: async () => ({
        id: "device-1",
        mac: "AA:BB:CC:11:22:33",
        ip: "10.10.0.15",
        name: "switch-cmc",
        hostname: "switch-cmc",
        vendor: "Cisco",
        model: "CBS250",
        candidateType: "SWITCH",
        centerDiscoveryJob: { centerId: "center-1" },
      }),
      update: async ({ data }: { data: { status: string } }) => {
        deviceStatus = data.status;
        return {};
      },
    },
    centerAsset: {
      findFirst: async (args: Record<string, unknown>) => {
        findFirstCalls.push(args);
        return { id: "asset-9" };
      },
    },
  };

  const centerAssetsService = {
    update: async (id: string, payload: Record<string, unknown>) => {
      updatedAssetId = id;
      updatedPayload = payload;
      return { id };
    },
    create: async () => {
      throw new Error("should not create");
    },
  };

  const service = new CenterDiscoveryService(prisma as any, centerAssetsService as any);
  await service.confirmDevice("device-1", {});

  assert.equal(updatedAssetId, "asset-9");
  assert.equal(deviceStatus, "MERGED");
  assert.deepEqual(findFirstCalls, [{
    where: { centerId: "center-1", mac: "AA:BB:CC:11:22:33" },
    select: { id: true },
  }]);
  assert.equal((updatedPayload as any).source, "DISCOVERY_ENRICHED");
});

test("confirmDevice falls back to IP after a MAC lookup misses", async () => {
  const findFirstCalls: Record<string, unknown>[] = [];
  let updatedAssetId = "";

  const prisma = {
    centerDiscoveredDevice: {
      findUniqueOrThrow: async () => ({
        id: "device-2",
        mac: "AA:BB:CC:11:22:44",
        ip: "10.10.0.16",
        name: "router-cmc",
        candidateType: "ROUTER",
        centerDiscoveryJob: { centerId: "center-1" },
      }),
      update: async () => ({}),
    },
    centerAsset: {
      findFirst: async (args: Record<string, unknown>) => {
        findFirstCalls.push(args);
        return findFirstCalls.length === 1 ? null : { id: "asset-ip" };
      },
    },
  };
  const centerAssetsService = {
    update: async (id: string) => {
      updatedAssetId = id;
      return { id };
    },
    create: async () => {
      throw new Error("should not create");
    },
  };

  const service = new CenterDiscoveryService(prisma as any, centerAssetsService as any);
  await service.confirmDevice("device-2", {});

  assert.equal(updatedAssetId, "asset-ip");
  assert.deepEqual(findFirstCalls, [
    { where: { centerId: "center-1", mac: "AA:BB:CC:11:22:44" }, select: { id: true } },
    { where: { centerId: "center-1", ip: "10.10.0.16" }, select: { id: true } },
  ]);
});

test("reconcileCenterAssets marks a matched asset ONLINE and refreshes lastSeenAt", async () => {
  const updateCalls: Record<string, unknown>[] = [];
  const prisma = {
    centerAsset: {
      findMany: async (args: Record<string, unknown>) => {
        updateCalls.push({ findManyArgs: args });
        return [{ id: "asset-1", ip: null, mac: "AA:BB:CC:11:22:33", operativeState: "OFFLINE", lastSeenAt: null }];
      },
      update: async (args: Record<string, unknown>) => {
        updateCalls.push(args);
        return {};
      },
    },
  };

  const service = new CenterDiscoveryService(prisma as any, {} as any);
  await (service as any).reconcileCenterAssets("center-1", [
    { ip: "10.10.0.15", mac: "aa-bb-cc-11-22-33", candidateType: null, name: null, vendor: null, model: null, hostname: null, discoveryConfidence: 50, rawPayload: {} },
  ]);

  const update = updateCalls.find((call) => "where" in call) as any;
  assert.equal(update.where.id, "asset-1");
  assert.equal(update.data.operativeState, "ONLINE");
  assert.ok(update.data.lastSeenAt instanceof Date);
});

test("reconcileCenterAssets marks a stale unmatched MAC-only asset OFFLINE", async () => {
  // No IP on file — the heartbeat scheduler can't reach this asset, so
  // discovery staleness is the only signal available for it.
  let updateArgs: Record<string, unknown> | null = null;
  const staleLastSeen = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
  const prisma = {
    centerAsset: {
      findMany: async () => [{ id: "asset-2", ip: null, mac: "AA:BB:CC:99:88:77", operativeState: "ONLINE", lastSeenAt: staleLastSeen }],
      update: async (args: Record<string, unknown>) => {
        updateArgs = args;
        return {};
      },
    },
  };

  const service = new CenterDiscoveryService(prisma as any, {} as any);
  await (service as any).reconcileCenterAssets("center-1", []);

  assert.deepEqual(updateArgs, { where: { id: "asset-2" }, data: { operativeState: "OFFLINE" } });
});

test("reconcileCenterAssets never demotes an IP-reachable asset to OFFLINE (that's the heartbeat scheduler's job)", async () => {
  // Even wildly stale, an asset with an IP must be left alone here — otherwise
  // this discovery-scan-cadence check and the 15s heartbeat scheduler would
  // fight over the same OFFLINE bit.
  let updateCalled = false;
  const veryStaleLastSeen = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const prisma = {
    centerAsset: {
      findMany: async () => [{ id: "asset-4", ip: "10.10.0.20", mac: null, operativeState: "ONLINE", lastSeenAt: veryStaleLastSeen }],
      update: async () => {
        updateCalled = true;
        return {};
      },
    },
  };

  const service = new CenterDiscoveryService(prisma as any, {} as any);
  await (service as any).reconcileCenterAssets("center-1", []);

  assert.equal(updateCalled, false);
});

test("reconcileCenterAssets leaves a recently-seen unmatched MAC-only asset alone (avoids single-miss flapping)", async () => {
  let updateCalled = false;
  const recentLastSeen = new Date(Date.now() - 60 * 1000); // 1 minute ago
  const prisma = {
    centerAsset: {
      findMany: async () => [{ id: "asset-3", ip: null, mac: "AA:BB:CC:11:00:00", operativeState: "ONLINE", lastSeenAt: recentLastSeen }],
      update: async () => {
        updateCalled = true;
        return {};
      },
    },
  };

  const service = new CenterDiscoveryService(prisma as any, {} as any);
  await (service as any).reconcileCenterAssets("center-1", []);

  assert.equal(updateCalled, false);
});

test("reconcileCenterAssets excludes MAINTENANCE/DEGRADED assets from automated state changes", async () => {
  let findManyArgs: Record<string, unknown> | null = null;
  const prisma = {
    centerAsset: {
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs = args;
        return [];
      },
    },
  };

  const service = new CenterDiscoveryService(prisma as any, {} as any);
  await (service as any).reconcileCenterAssets("center-1", []);

  assert.deepEqual((findManyArgs as any).where.operativeState, { in: ["ONLINE", "OFFLINE"] });
});

test("executeDiscovery uses LAN_ORANGUTAN_CMD when configured for CMC discovery", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "center-discovery-"));
  const scriptPath = join(tempDir, "fake-orangutan.py");
  await writeFile(
    scriptPath,
    [
      "import json, sys",
      "print(json.dumps({",
      "  'success': True,",
      "  'devices': [{",
      "    'ipAddress': sys.argv[1],",
      "    'hostName': sys.argv[2],",
      "    'category': 'switch',",
      "    'score': 88",
      "  }]",
      "}))",
      "",
    ].join("\n"),
    "utf8",
  );

  const originalCommand = process.env.LAN_ORANGUTAN_CMD;
  process.env.LAN_ORANGUTAN_CMD = `python3 ${scriptPath} {target} {ip}`;

  try {
    const service = new CenterDiscoveryService({} as any, {} as any);
    const devices = await (service as any).executeDiscovery("172.16.45.0/24", "172.16.45.1");

    assert.deepEqual(devices, [{
      ipAddress: "172.16.45.0/24",
      hostName: "172.16.45.1",
      category: "switch",
      score: 88,
    }]);
  } finally {
    if (originalCommand == null) delete process.env.LAN_ORANGUTAN_CMD;
    else process.env.LAN_ORANGUTAN_CMD = originalCommand;
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("executeDiscovery fails explicitly when no real scanner is configured", async () => {
  const originalCommand = process.env.LAN_ORANGUTAN_CMD;
  const originalAllowMock = process.env.DISCOVERY_ALLOW_MOCK;
  delete process.env.LAN_ORANGUTAN_CMD;
  delete process.env.DISCOVERY_ALLOW_MOCK;

  try {
    const service = new CenterDiscoveryService({} as any, {} as any, { upsertScanFindings: async () => undefined } as any);
    await assert.rejects(
      () => (service as any).executeDiscovery("172.16.45.0/24", "172.16.45.1"),
      /LAN_ORANGUTAN_CMD no está configurado/,
    );
  } finally {
    if (originalCommand == null) delete process.env.LAN_ORANGUTAN_CMD;
    else process.env.LAN_ORANGUTAN_CMD = originalCommand;
    if (originalAllowMock == null) delete process.env.DISCOVERY_ALLOW_MOCK;
    else process.env.DISCOVERY_ALLOW_MOCK = originalAllowMock;
  }
});

test("runForCenter stores out-of-subnet discoveries separately from official CMC findings", async () => {
  let externalArgs: unknown[] = [];
  let createdDevices: Record<string, unknown>[] = [];
  let updatedSummary: { status: string; rawSummary: Record<string, unknown>; finishedAt: Date } | null = null;

  class TestService extends CenterDiscoveryService {
    protected override async executeDiscovery() {
      return [
        { ip: "172.16.45.10", mac: "AA:BB:CC:11:22:33", hostname: "in-range", type: "switch", confidence: 80 },
        { ip: "172.16.46.10", mac: "AA:BB:CC:11:22:44", hostname: "external", type: "switch", confidence: 70 },
      ];
    }

    protected override async reconcileCenterAssets() {
      return;
    }
  }

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        primaryIp: "172.16.45.1",
        scanSubnetCidr: "172.16.45.0/24",
      }),
    },
    centerDiscoveryJob: {
      create: async () => ({ id: "job-1" }),
      update: async ({ data }: { data: { status: string; rawSummary: Record<string, unknown>; finishedAt: Date } }) => {
        updatedSummary = data;
        return {};
      },
      findUniqueOrThrow: async () => ({ id: "job-1", discoveredDevices: [] }),
    },
    centerDiscoveredDevice: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        createdDevices = data;
        return { count: data.length };
      },
    },
  };

  const externalDiscoveryService = {
    upsertScanFindings: async (...args: unknown[]) => {
      externalArgs = args;
    },
  };

  const service = new TestService(prisma as any, {} as any, externalDiscoveryService as any);
  await service.runForCenter("center-1");

  assert.equal(createdDevices.length, 1);
  assert.equal(createdDevices[0]?.ip, "172.16.45.10");
  assert.deepEqual(externalArgs, [
    "center-1",
    "172.16.45.0/24",
    "172.16.45.1",
    [{
      ip: "172.16.46.10",
      mac: "AA:BB:CC:11:22:44",
      vendor: null,
      model: null,
      hostname: "external",
      candidateType: "SWITCH",
      discoveryConfidence: 70,
    }],
    "SCAN",
  ]);
  assert.ok(updatedSummary);
  const summary = updatedSummary as unknown as { status: string; rawSummary: Record<string, unknown>; finishedAt: Date };
  assert.deepEqual(summary, {
    status: "COMPLETED",
    rawSummary: { source: "mock", discoveredCount: 1, externalCount: 1 },
    finishedAt: summary.finishedAt,
  });
  assert.ok(summary.finishedAt instanceof Date);
});
