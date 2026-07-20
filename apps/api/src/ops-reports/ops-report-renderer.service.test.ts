import assert from "node:assert/strict";
import test from "node:test";

import { OpsReportRendererService } from "./ops-report-renderer.service";
import { ReportPreviewPayload } from "./ops-reports.types";

const payload: ReportPreviewPayload = {
  title: "Informe de monitoreo",
  summary: [{ label: "Nodos fuera de línea", value: 2 }],
  charts: [],
  tables: [{ title: "Detalle", columns: ["Código", "Estado"], rows: [["N1", "OFFLINE"]] }],
  findings: ["N1 fue el más inestable"],
};

test("renderCsv serializes summary and tables into a downloadable CSV artifact", async () => {
  const service = new OpsReportRendererService();

  const file = await service.renderCsv(payload);

  assert.equal(file.mimeType, "text/csv");
  assert.equal(file.fileName.endsWith(".csv"), true);
  assert.match(file.buffer.toString("utf8"), /Nodos fuera de línea/);
  assert.match(file.buffer.toString("utf8"), /Código,Estado/);
});

test("renderPdf returns a branded downloadable artifact", async () => {
  const service = new OpsReportRendererService();

  const file = await service.renderPdf(payload, {
    profileId: "brand-1",
    name: "SIGES",
    logoUrl: null,
    loginMessage: null,
  });

  assert.equal(file.mimeType, "application/pdf");
  assert.equal(file.fileName.endsWith(".pdf"), true);
  assert.match(file.buffer.toString("utf8"), /SIGES/);
});
