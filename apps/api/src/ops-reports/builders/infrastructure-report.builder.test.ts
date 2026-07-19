import assert from "node:assert/strict";
import test from "node:test";

import { InfrastructureReportBuilder } from "./infrastructure-report.builder";

test("InfrastructureReportBuilder scopes inventory by range and geographic filters", async () => {
  const calls: unknown[] = [];
  const builder = new InfrastructureReportBuilder({
    centerAsset: {
      findMany: async (args: any) => {
        calls.push(args);
        return args.where?.createdAt?.gte?.getTime() === new Date("2026-07-01T00:00:00.000Z").getTime()
          && args.where?.operativeState === "ONLINE"
          && args.where?.centerId === "center-1"
          && args.where?.center?.projectId === "project-1"
          && args.where?.center?.project?.cityId === "city-1"
          ? [{ assetType: "SWITCH", vendor: "Cisco", center: { name: "CMC 1" } }]
          : [
            { assetType: "SWITCH", vendor: "Cisco", center: { name: "CMC 1" } },
            { assetType: "UPS", vendor: "Fuera de rango", center: { name: "CMC 2" } },
          ];
      },
    },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07", cityId: "city-1", projectId: "project-1", centerId: "center-1", state: "ONLINE" });

  assert.deepEqual(calls, [{
    where: {
      createdAt: { gte: new Date("2026-07-01T00:00:00.000Z"), lte: new Date("2026-07-07T23:59:59.999Z") },
      operativeState: "ONLINE",
      centerId: "center-1",
      center: { projectId: "project-1", project: { cityId: "city-1" } },
    },
    select: { assetType: true, vendor: true, center: { select: { name: true } } },
    orderBy: [{ assetType: "asc" }, { vendor: "asc" }],
  }]);
  assert.equal(report.summary[1]?.value, 1);
  assert.equal(report.tables[0]?.title, "Inventario consolidado");
});
