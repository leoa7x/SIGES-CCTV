import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";
import { countBy, dateRange } from "./report-builder.utils";

export class InfrastructureReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const assets = await this.prisma.centerAsset.findMany({
      where: {
        createdAt: dateRange(filters),
        ...(filters.state ? { operativeState: filters.state as never } : {}),
        ...(filters.centerId ? { centerId: filters.centerId } : {}),
        center: {
          ...(filters.projectId ? { projectId: filters.projectId } : {}),
          project: filters.cityId ? { cityId: filters.cityId } : {},
        },
      },
      select: {
        assetType: true,
        vendor: true,
        center: { select: { name: true } },
      },
      orderBy: [{ assetType: "asc" }, { vendor: "asc" }],
    });
    const byType = countBy(assets, (asset) => asset.assetType);
    const byVendor = countBy(assets, (asset) => asset.vendor ?? "Sin fabricante");

    return {
      title: "Informe de infraestructura",
      summary: [
        { label: "Centros de monitoreo", value: new Set(assets.map((asset) => asset.center.name)).size },
        { label: "Activos inventariados", value: assets.length },
      ],
      charts: [{
        type: "bar",
        title: "Activos por tipo",
        labels: Array.from(byType.keys()),
        values: Array.from(byType.values()),
      }],
      tables: [{
        title: "Inventario consolidado",
        columns: ["Centro", "Tipo", "Fabricante"],
        rows: assets.map((asset) => [asset.center.name, asset.assetType, asset.vendor ?? "Sin fabricante"]),
      }],
      findings: Array.from(byVendor.entries()).map(([vendor, count]) => `${vendor}: ${count} activo(s) inventariado(s).`),
    };
  }
}
