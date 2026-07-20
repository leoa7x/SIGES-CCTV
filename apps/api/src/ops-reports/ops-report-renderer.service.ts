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

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\xff]/g, "?");
}

function buildPdf(lines: string[]) {
  const linesPerPage = 42;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / linesPerPage)) }, (_, index) =>
    lines.slice(index * linesPerPage, (index + 1) * linesPerPage),
  );
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${5 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  for (const pageLines of pages) {
    const content = ["BT", "/F1 12 Tf", "50 790 Td", ...pageLines.flatMap((line, index) => [
      index === 0 ? `(${escapePdfText(line)}) Tj` : `0 -17 Td (${escapePdfText(line)}) Tj`,
    ]), "ET"].join("\n");
    const pageObject = objects.length + 1;
    const contentObject = pageObject + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObject} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
  }

  let document = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document, "latin1"));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document, "latin1");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document, "latin1");
}

@Injectable()
export class OpsReportRendererService {
  async renderPdf(payload: ReportPreviewPayload, branding: BrandingSnapshot): Promise<HistoricalArtifactInput> {
    const lines = [
      branding.name,
      payload.title,
      "",
      "Resumen",
      ...payload.summary.map((item) => `${item.label}: ${item.value}`),
      "",
      "Graficos",
      ...payload.charts.flatMap((chart) => [chart.title, ...chart.labels.map((label, index) => `${label}: ${chart.values[index] ?? 0}`)]),
      "",
      "Tablas",
      ...payload.tables.flatMap((table) => [table.title, table.columns.join(" | "), ...table.rows.map((row) => row.join(" | "))]),
      "",
      "Hallazgos",
      ...payload.findings,
    ];
    return {
      fileName: `${slugify(payload.title)}.pdf`,
      buffer: buildPdf(lines),
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
