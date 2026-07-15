import assert from "node:assert/strict";
import test from "node:test";

import { MonitoringCentersService } from "./monitoring-centers.service";

test("findOne includes center assets for CMC topology and admin screens", async () => {
  let includeArgs: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async (args: Record<string, unknown>) => {
        includeArgs = args;
        return { id: "center-1" };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  await service.findOne("center-1");

  assert.deepEqual(includeArgs, {
    where: { id: "center-1" },
    include: {
      project: { include: { city: true } },
      routes: { include: { _count: { select: { nodes: true } } } },
      centerAssets: { orderBy: [{ assetType: "asc" }, { name: "asc" }] },
    },
  });
});

test("update geocodes the CMC when coordinates are omitted and the project city is available", async () => {
  let updatedData: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        name: "CMC Villavicencio",
        address: "Cra 1 # 2-3",
        project: { city: { name: "Villavicencio" } },
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
        return { id: "center-1", ...data };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  (service as any).geocode = async () => ({ lat: 4.142, lng: -73.6266 });

  await service.update("center-1", {
    name: "CMC Villavicencio",
    address: "Cra 1 # 2-3",
    lat: undefined,
    lng: undefined,
  });

  assert.deepEqual(updatedData, {
    name: "CMC Villavicencio",
    address: "Cra 1 # 2-3",
    lat: 4.142,
    lng: -73.6266,
  });
});
