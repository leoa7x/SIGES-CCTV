import assert from "node:assert/strict";
import test from "node:test";

import { MonitoringCentersService } from "./monitoring-centers.service";

test("findOne includes CMC discovery backlog for admin detail", async () => {
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
      discoveryJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          discoveredDevices: {
            orderBy: { createdAt: "desc" },
            include: { matchedAsset: { select: { id: true, name: true, assetType: true } } },
          },
        },
      },
    },
  });
});

test("update persists CMC scan target fields", async () => {
  let updatedData: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
        return { id: "center-1", ...data };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  await service.update("center-1", {
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
  } as any);

  assert.deepEqual(updatedData, {
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
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
