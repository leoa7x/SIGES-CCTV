import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";
import { countBy, dateRange } from "./report-builder.utils";

@Injectable()
export class IncidentsReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const centerScope = {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      project: filters.cityId ? { cityId: filters.cityId } : {},
    };
    const incidents = await this.prisma.incident.findMany({
      where: {
        detectedAt: dateRange(filters),
        ...(filters.nodeId ? { nodeId: filters.nodeId } : {}),
        ...(filters.centerId ? { centerId: filters.centerId } : {}),
        ...(filters.severity ? { severity: filters.severity as never } : {}),
        ...(filters.state ? { status: filters.state as never } : {}),
        ...(filters.cityId || filters.projectId ? {
          OR: [
            { node: { route: { center: centerScope } } },
            { center: centerScope },
          ],
        } : {}),
      },
      select: { title: true, severity: true, detectedAt: true, resolvedAt: true },
      orderBy: { detectedAt: "asc" },
    });
    const bySeverity = countBy(incidents, (incident) => incident.severity);
    const closeTimes = incidents
      .filter((incident) => incident.resolvedAt)
      .map((incident) => incident.resolvedAt!.getTime() - incident.detectedAt.getTime());
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
