import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";

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

function dateRange(filters: OpsReportFilters) {
  return {
    gte: new Date(`${filters.dateFrom}T00:00:00.000Z`),
    lte: new Date(`${filters.dateTo}T23:59:59.999Z`),
  };
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  return items.reduce((counts, item) => {
    const label = key(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}
