import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";

export class MonitoringReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(_filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const nodes = await this.prisma.node.findMany({
      select: { code: true, operativeState: true, heartbeatFailureCount: true },
    });
    const alerts = await this.prisma.operationalAlert.findMany({
      where: { isActive: true },
      select: { severity: true, title: true, detail: true },
    });
    const offline = nodes.filter((node) => node.operativeState === "OFFLINE");
    const critical = alerts.filter((alert) => alert.severity === "CRITICAL").length;

    return {
      title: "Informe de monitoreo",
      summary: [
        { label: "Nodos fuera de línea", value: offline.length },
        { label: "Alertas críticas activas", value: critical },
      ],
      charts: [
        { type: "pie", title: "Severidad de alertas", labels: ["Críticas"], values: [critical] },
      ],
      tables: [{
        title: "Entidades inestables",
        columns: ["Código", "Estado", "Fallas"],
        rows: offline.map((node) => [node.code, node.operativeState, String(node.heartbeatFailureCount)]),
      }],
      findings: offline.length > 0
        ? [`${offline[0]?.code} reportó indisponibilidad durante el periodo.`]
        : ["No se detectaron indisponibilidades en el periodo."],
    };
  }
}
