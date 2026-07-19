import assert from "node:assert/strict";
import test from "node:test";

import { MonitoringReportBuilder } from "./monitoring-report.builder";

test("MonitoringReportBuilder uses range-scoped telemetry and alert queries", async () => {
  const snapshotCalls: unknown[] = [];
  const alertCalls: unknown[] = [];
  const builder = new MonitoringReportBuilder({
    networkTelemetrySnapshot: {
      findMany: async (args: any) => {
        snapshotCalls.push(args);
        return args.where?.capturedAt?.gte?.getTime() === new Date("2026-07-01T00:00:00.000Z").getTime()
          && args.where?.nodeId === "node-1"
          && args.where?.node?.operativeState === "OFFLINE"
          && args.where?.node?.route?.monitoringCenterId === "center-1"
          && args.where?.node?.route?.center?.projectId === "project-1"
          && args.where?.node?.route?.center?.project?.cityId === "city-1"
          ? [{ node: { code: "N1" }, alertCount: 2, capturedAt: new Date("2026-07-02T12:00:00.000Z") }]
          : [
            { node: { code: "N1" }, alertCount: 2, capturedAt: new Date("2026-07-02T12:00:00.000Z") },
            { node: { code: "N2" }, alertCount: 9, capturedAt: new Date("2026-06-30T12:00:00.000Z") },
            { node: { code: "N3" }, alertCount: 7, capturedAt: new Date("2026-07-02T12:00:00.000Z") },
          ];
      },
    },
    networkTelemetryAlert: {
      findMany: async (args: any) => {
        alertCalls.push(args);
        return args.where?.lastSeenAt?.gte?.getTime() === new Date("2026-07-01T00:00:00.000Z").getTime()
          && args.where?.severity === "CRITICAL"
          && args.where?.nodeId === "node-1"
          ? [{ severity: "CRITICAL", title: "Nodo sin snapshots recientes", detail: "...", node: { code: "N1" } }]
          : [
            { severity: "CRITICAL", title: "Nodo sin snapshots recientes", detail: "...", node: { code: "N1" } },
            { severity: "WARNING", title: "Alerta fuera de alcance", detail: "...", node: { code: "N2" } },
          ];
      },
    },
  } as any);

  const report = await builder.build({
    dateFrom: "2026-07-01",
    dateTo: "2026-07-07",
    cityId: "city-1",
    projectId: "project-1",
    centerId: "center-1",
    nodeId: "node-1",
    severity: "CRITICAL",
    state: "OFFLINE",
  });

  assert.deepEqual(snapshotCalls, [{
    where: {
      capturedAt: { gte: new Date("2026-07-01T00:00:00.000Z"), lte: new Date("2026-07-07T23:59:59.999Z") },
      nodeId: "node-1",
      node: {
        operativeState: "OFFLINE",
        route: { monitoringCenterId: "center-1", center: { projectId: "project-1", project: { cityId: "city-1" } } },
      },
    },
    select: { node: { select: { code: true } }, alertCount: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  }]);
  assert.deepEqual(alertCalls, [{
    where: {
      lastSeenAt: { gte: new Date("2026-07-01T00:00:00.000Z"), lte: new Date("2026-07-07T23:59:59.999Z") },
      nodeId: "node-1",
      node: {
        operativeState: "OFFLINE",
        route: { monitoringCenterId: "center-1", center: { projectId: "project-1", project: { cityId: "city-1" } } },
      },
      severity: "CRITICAL",
    },
    select: { severity: true, title: true, detail: true, node: { select: { code: true } } },
    orderBy: { lastSeenAt: "asc" },
  }]);
  assert.equal(report.summary[0]?.value, 1);
  assert.equal(report.summary[1]?.value, 1);
  assert.equal(report.charts[0]?.type, "pie");
});
