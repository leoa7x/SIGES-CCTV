import assert from "node:assert/strict";
import test from "node:test";

import { CenterAssetsService } from "./center-assets.service";

test("create stores a manual center asset linked to its CMC", async () => {
  let createArgs: Record<string, unknown> | null = null;

  const prisma = {
    centerAsset: {
      create: async (args: Record<string, unknown>) => {
        createArgs = args;
        return {
          id: "asset-1",
          name: "Core Switch CMC",
          assetType: "SWITCH",
          center: { id: "center-1", name: "CMC Central" },
        };
      },
    },
  };

  const service = new CenterAssetsService(prisma as any);

  await service.create({
    centerId: "center-1",
    assetType: "SWITCH",
    name: "Core Switch CMC",
    ip: "10.10.10.2",
    source: "DISCOVERED",
  } as any);

  assert.deepEqual(createArgs, {
    data: {
      assetType: "SWITCH",
      name: "Core Switch CMC",
      ip: "10.10.10.2",
      center: { connect: { id: "center-1" } },
      source: "MANUAL",
      lastSeenAt: (createArgs as any).data.lastSeenAt,
    },
    include: {
      center: { select: { id: true, name: true } },
    },
  });

  assert.ok((createArgs as any).data.lastSeenAt instanceof Date);
});
