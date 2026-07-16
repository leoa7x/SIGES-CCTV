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
