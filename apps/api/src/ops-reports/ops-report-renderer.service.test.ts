import assert from "node:assert/strict";
import test from "node:test";

import { OpsReportRendererService } from "./ops-report-renderer.service";
import { ReportPreviewPayload } from "./ops-reports.types";

const payload: ReportPreviewPayload = {
  title: "Informe de monitoreo",
  summary: [{ label: "Nodos fuera de línea", value: 2 }],
  charts: [{ type: "bar", title: "Alertas por nodo", labels: ["N1", "N2"], values: [3, 1] }],
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

test("renderPdf returns PDF bytes containing each report payload section", async () => {
  const service = new OpsReportRendererService();

  const file = await service.renderPdf(payload, {
    profileId: "brand-1",
    name: "SIGES",
    logoUrl: null,
    loginMessage: null,
  });

  assert.equal(file.mimeType, "application/pdf");
  assert.equal(file.fileName.endsWith(".pdf"), true);
  assert.equal(file.buffer.subarray(0, 5).toString("ascii"), "%PDF-");

  const document = file.buffer.toString("latin1");
  assert.match(document, /SIGES/);
  assert.match(document, /Informe de monitoreo/);
  assert.match(document, /Resumen/);
  assert.match(document, /Nodos fuera de línea: 2/);
  assert.match(document, /Graficos/);
  assert.match(document, /Alertas por nodo/);
  assert.match(document, /N1: 3/);
  assert.match(document, /Detalle/);
  assert.match(document, /N1 \| OFFLINE/);
  assert.match(document, /Hallazgos/);
  assert.match(document, /N1 fue el más inestable/);
});
