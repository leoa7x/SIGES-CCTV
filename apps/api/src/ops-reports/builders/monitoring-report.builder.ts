import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";

export class MonitoringReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const nodeScope = {
      ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
      node: {
        ...(filters.state ? { operativeState: filters.state as never } : {}),
        route: {
          ...(filters.centerId ? { monitoringCenterId: filters.centerId } : {}),
          center: {
            ...(filters.projectId ? { projectId: filters.projectId } : {}),
            project: filters.cityId ? { cityId: filters.cityId } : {},
          },
        },
      },
    };
    const range = dateRange(filters);
    const [snapshots, alerts] = await Promise.all([
      this.prisma.networkTelemetrySnapshot.findMany({
        where: { capturedAt: range, ...nodeScope },
        select: { node: { select: { code: true } }, alertCount: true, capturedAt: true },
        orderBy: { capturedAt: "asc" },
      }),
      this.prisma.networkTelemetryAlert.findMany({
        where: { lastSeenAt: range, ...nodeScope, ...(filters.severity ? { severity: filters.severity as never } : {}) },
        select: { severity: true, title: true, detail: true, node: { select: { code: true } } },
        orderBy: { lastSeenAt: "asc" },
      }),
    ]);
    const unstable = snapshots.filter((snapshot) => snapshot.alertCount > 0);
    const critical = alerts.filter((alert) => alert.severity === "CRITICAL").length;

    return {
      title: "Informe de monitoreo",
      summary: [
        { label: "Nodos con alertas de telemetría", value: new Set(unstable.map((snapshot) => snapshot.node.code)).size },
        { label: "Alertas críticas detectadas", value: critical },
      ],
      charts: [
        { type: "pie", title: "Severidad de alertas", labels: ["Críticas"], values: [critical] },
      ],
      tables: [{
        title: "Entidades inestables",
        columns: ["Código", "Snapshots con alertas", "Alertas registradas"],
        rows: Array.from(new Set(unstable.map((snapshot) => snapshot.node.code))).map((code) => [
          code,
          String(unstable.filter((snapshot) => snapshot.node.code === code).length),
          String(alerts.filter((alert) => alert.node.code === code).length),
        ]),
      }],
      findings: unstable.length > 0
        ? [`${unstable[0]?.node.code} registró alertas de telemetría durante el periodo.`]
        : ["No se detectaron alertas de telemetría durante el periodo."],
    };
  }
}

function dateRange(filters: OpsReportFilters) {
  return {
    gte: new Date(`${filters.dateFrom}T00:00:00.000Z`),
    lte: new Date(`${filters.dateTo}T23:59:59.999Z`),
  };
}
