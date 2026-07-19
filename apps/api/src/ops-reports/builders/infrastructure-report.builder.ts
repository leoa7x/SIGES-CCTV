import { PrismaService } from "../../prisma/prisma.service";
import { OpsReportFilters, ReportPreviewPayload } from "../ops-reports.types";

export class InfrastructureReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(_filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const centers = await this.prisma.monitoringCenter.findMany({
      select: {
        id: true,
        name: true,
        centerAssets: { select: { assetType: true, vendor: true } },
      },
    });
    const assets = centers.flatMap((center) => center.centerAssets.map((asset) => ({
      center: center.name,
      ...asset,
    })));
    const byType = countBy(assets, (asset) => asset.assetType);
    const byVendor = countBy(assets, (asset) => asset.vendor ?? "Sin fabricante");

    return {
      title: "Informe de infraestructura",
      summary: [
        { label: "Centros de monitoreo", value: centers.length },
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
        rows: assets.map((asset) => [asset.center, asset.assetType, asset.vendor ?? "Sin fabricante"]),
      }],
      findings: Array.from(byVendor.entries()).map(([vendor, count]) => `${vendor}: ${count} activo(s) inventariado(s).`),
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
