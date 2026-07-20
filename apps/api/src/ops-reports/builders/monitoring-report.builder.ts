import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";
import { dateRange } from "./report-builder.utils";

@Injectable()
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
    const [snapshots, alerts, offlineNodeAlerts] = await Promise.all([
      this.prisma.networkTelemetrySnapshot.findMany({
        where: { capturedAt: range, ...nodeScope },
        select: { node: { select: { code: true } }, alertCount: true, capturedAt: true },
        orderBy: { capturedAt: "asc" },
      }),
      this.prisma.networkTelemetryAlert.findMany({
        where: {
          firstSeenAt: { lte: range.lte },
          OR: [{ resolvedAt: null }, { resolvedAt: { gte: range.gte } }],
          ...nodeScope,
          ...(filters.severity ? { severity: filters.severity as never } : {}),
        },
        select: { severity: true, title: true, detail: true, node: { select: { code: true } } },
        orderBy: { firstSeenAt: "asc" },
      }),
      this.prisma.networkTelemetryAlert.findMany({
        where: {
          firstSeenAt: { lte: range.lte },
          OR: [{ resolvedAt: null }, { resolvedAt: { gte: range.gte } }],
          ...nodeScope,
          kind: "NODE_SILENT",
        },
        select: { node: { select: { code: true } } },
      }),
    ]);
    const unstable = snapshots.filter((snapshot) => snapshot.alertCount > 0);
    const critical = alerts.filter((alert) => alert.severity === "CRITICAL").length;
    const offlineNodeCodes = new Set(offlineNodeAlerts.map((alert) => alert.node.code));

    return {
      title: "Informe de monitoreo",
      summary: [
        { label: "Nodos fuera de línea", value: offlineNodeCodes.size },
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
      findings: offlineNodeCodes.size > 0
        ? [`${offlineNodeAlerts[0]?.node.code} reportó indisponibilidad durante el periodo.`]
        : ["No se detectaron nodos fuera de línea durante el periodo."],
    };
  }
}
