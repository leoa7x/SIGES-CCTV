import assert from "node:assert/strict";
import test from "node:test";

import { buildHistoryDownloadRows, buildReportRequest } from "./ops-reports";

test("buildReportRequest normalizes date range and optional filters", () => {
  const request = buildReportRequest({
    reportType: "MONITORING",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-07",
    cityId: "",
    projectId: "project-1",
  });

  assert.deepEqual(request, {
    reportType: "MONITORING",
    filters: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
      cityId: null,
      projectId: "project-1",
      centerId: null,
      nodeId: null,
      severity: null,
      state: null,
    },
  });
});

test("buildHistoryDownloadRows exposes PDF and CSV downloads with permission-aware availability", () => {
  const rows = buildHistoryDownloadRows([
    {
      id: "report-1",
      reportType: "MONITORING",
      title: "Monitoreo semanal",
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-07T00:00:00.000Z",
      trigger: "MANUAL",
      createdAt: "2026-07-08T10:00:00.000Z",
      artifacts: [
        { format: "PDF", fileName: "monitoreo.pdf", downloadPath: "/ops-lifecycle/reports/report-1/artifacts/PDF/download", mimeType: "application/pdf" },
        { format: "CSV", fileName: "monitoreo.csv", downloadPath: "/ops-lifecycle/reports/report-1/artifacts/CSV/download", mimeType: "text/csv" },
      ],
    },
  ], true);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.downloads.length, 2);
  assert.equal(rows[0]?.downloads[0]?.enabled, true);
  assert.equal(rows[0]?.downloads[0]?.downloadPath, "/ops-lifecycle/reports/report-1/artifacts/PDF/download");
});
