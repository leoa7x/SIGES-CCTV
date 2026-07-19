import assert from "node:assert/strict";
import test from "node:test";

import { InfrastructureReportBuilder } from "./infrastructure-report.builder";

test("InfrastructureReportBuilder groups assets by type and vendor", async () => {
  const builder = new InfrastructureReportBuilder({
    monitoringCenter: {
      findMany: async () => [{
        id: "c1",
        name: "CMC 1",
        centerAssets: [{ assetType: "SWITCH", vendor: "Cisco" }],
      }],
    },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });

  assert.equal(report.tables[0]?.title, "Inventario consolidado");
});
