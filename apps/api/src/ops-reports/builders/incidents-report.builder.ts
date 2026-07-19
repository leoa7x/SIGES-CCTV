import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";

export class IncidentsReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(_filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const incidents = await this.prisma.incident.findMany({
      select: { title: true, severity: true, createdAt: true, resolvedAt: true },
    });
    const bySeverity = countBy(incidents, (incident) => incident.severity);
    const closeTimes = incidents
      .filter((incident) => incident.resolvedAt)
      .map((incident) => incident.resolvedAt!.getTime() - incident.createdAt.getTime());
    const averageCloseHours = closeTimes.length === 0
      ? "Sin cierres"
      : `${Math.round(closeTimes.reduce((total, duration) => total + duration, 0) / closeTimes.length / 3_600_000)} h`;

    return {
      title: "Informe de incidentes",
      summary: [
        { label: "Incidentes registrados", value: incidents.length },
        { label: "Tiempo promedio de cierre", value: averageCloseHours },
      ],
      charts: [{
        type: "bar",
        title: "Incidentes por severidad",
        labels: Array.from(bySeverity.keys()),
        values: Array.from(bySeverity.values()),
      }],
      tables: [{
        title: "Incidentes del periodo",
        columns: ["Título", "Severidad", "Estado de cierre"],
        rows: incidents.map((incident) => [
          incident.title,
          incident.severity,
          incident.resolvedAt ? "Cerrado" : "Abierto",
        ]),
      }],
      findings: incidents.length > 0
        ? [`${incidents.length} incidente(s) registrado(s) durante el periodo.`]
        : ["No se registraron incidentes durante el periodo."],
    };
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  return items.reduce((counts, item) => {
    const label = key(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}
