import assert from "node:assert/strict";
import test from "node:test";

import { CenterDiscoveryService } from "./center-discovery.service";

test("confirmDevice merges by MAC before creating a new CenterAsset", async () => {
  let updatedAssetId = "";
  let deviceStatus = "";

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
      findFirst: async () => ({ id: "asset-9" }),
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
  await service.confirmDevice("device-1", {});

  assert.equal(updatedAssetId, "asset-9");
  assert.equal(deviceStatus, "MERGED");
});
