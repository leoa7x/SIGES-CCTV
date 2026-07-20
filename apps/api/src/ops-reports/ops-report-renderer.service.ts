import { Injectable } from "@nestjs/common";

import { BrandingSnapshot, HistoricalArtifactInput, ReportPreviewPayload } from "./ops-reports.types";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "informe";
}

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Injectable()
export class OpsReportRendererService {
  async renderPdf(payload: ReportPreviewPayload, branding: BrandingSnapshot): Promise<HistoricalArtifactInput> {
    const html = `<!doctype html><html><body><h1>${branding.name}</h1><h2>${payload.title}</h2></body></html>`;
    return {
      fileName: `${slugify(payload.title)}.pdf`,
      buffer: Buffer.from(html, "utf8"),
      mimeType: "application/pdf",
    };
  }

  async renderCsv(payload: ReportPreviewPayload): Promise<HistoricalArtifactInput> {
    const lines = [
      ["Sección", "Etiqueta", "Valor"].map(escapeCsv).join(","),
      ...payload.summary.map((item) => ["Resumen", item.label, item.value].map(escapeCsv).join(",")),
      ...payload.tables.flatMap((table) => [
        [table.title].map(escapeCsv).join(","),
        table.columns.map(escapeCsv).join(","),
        ...table.rows.map((row) => row.map(escapeCsv).join(",")),
      ]),
      ...payload.findings.map((finding) => ["Hallazgo", finding].map(escapeCsv).join(",")),
    ];

    return {
      fileName: `${slugify(payload.title)}.csv`,
      buffer: Buffer.from(lines.join("\n"), "utf8"),
      mimeType: "text/csv",
    };
  }
}
