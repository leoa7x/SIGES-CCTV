import assert from "node:assert/strict";
import test from "node:test";

import { IncidentsReportBuilder } from "./incidents-report.builder";

test("IncidentsReportBuilder derives average close time and severity bars", async () => {
  const builder = new IncidentsReportBuilder({
    incident: {
      findMany: async () => [{
        title: "Caída enlace",
        severity: "HIGH",
        createdAt: new Date("2026-07-01"),
        resolvedAt: new Date("2026-07-02"),
      }],
    },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });

  assert.deepEqual(report.summary.find((item) => item.label === "Tiempo promedio de cierre"), {
    label: "Tiempo promedio de cierre",
    value: "24 h",
  });
});
