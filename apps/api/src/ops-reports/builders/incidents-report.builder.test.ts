import assert from "node:assert/strict";
import test from "node:test";

import { IncidentsReportBuilder } from "./incidents-report.builder";

test("IncidentsReportBuilder scopes incidents by date, hierarchy, node, severity, and state", async () => {
  const calls: unknown[] = [];
  const builder = new IncidentsReportBuilder({
    incident: {
      findMany: async (args: any) => {
        calls.push(args);
        return args.where?.detectedAt?.gte?.getTime() === new Date("2026-07-01T00:00:00.000Z").getTime()
          && args.where?.severity === "HIGH"
          && args.where?.status === "RESOLVED"
          && args.where?.nodeId === "node-1"
          && args.where?.centerId === "center-1"
          && args.where?.OR?.[0]?.node?.route?.center?.project?.cityId === "city-1"
          && args.where?.OR?.[1]?.center?.projectId === "project-1"
          ? [{ title: "Caída enlace", severity: "HIGH", detectedAt: new Date("2026-07-01"), resolvedAt: new Date("2026-07-02") }]
          : [
            { title: "Caída enlace", severity: "HIGH", detectedAt: new Date("2026-07-01"), resolvedAt: new Date("2026-07-02") },
            { title: "Incidente fuera de rango", severity: "HIGH", detectedAt: new Date("2026-06-30"), resolvedAt: null },
          ];
      },
    },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07", cityId: "city-1", projectId: "project-1", centerId: "center-1", nodeId: "node-1", severity: "HIGH", state: "RESOLVED" });

  assert.equal((calls[0] as any).where.detectedAt.gte.getTime(), new Date("2026-07-01T00:00:00.000Z").getTime());
  assert.equal((calls[0] as any).where.detectedAt.lte.getTime(), new Date("2026-07-07T23:59:59.999Z").getTime());
  assert.equal((calls[0] as any).where.OR[0].node.route.center.project.cityId, "city-1");
  assert.equal((calls[0] as any).where.OR[1].center.projectId, "project-1");
  assert.equal(report.summary[0]?.value, 1);
  assert.deepEqual(report.summary.find((item) => item.label === "Tiempo promedio de cierre"), {
    label: "Tiempo promedio de cierre",
    value: "24 h",
  });
});
