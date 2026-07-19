import assert from "node:assert/strict";
import test from "node:test";

import { MonitoringReportBuilder } from "./monitoring-report.builder";

test("MonitoringReportBuilder summarizes offline nodes and alert severity distribution", async () => {
  const builder = new MonitoringReportBuilder({
    node: {
      findMany: async () => [{ code: "N1", operativeState: "OFFLINE", heartbeatFailureCount: 3 }],
    },
    operationalAlert: {
      findMany: async () => [{ severity: "CRITICAL", title: "Nodo fuera de línea", detail: "..." }],
    },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });

  assert.equal(report.summary[0]?.label, "Nodos fuera de línea");
  assert.equal(report.charts[0]?.type, "pie");
});
