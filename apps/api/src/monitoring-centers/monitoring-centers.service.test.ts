import assert from "node:assert/strict";
import test from "node:test";

import { MonitoringCentersService } from "./monitoring-centers.service";

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
