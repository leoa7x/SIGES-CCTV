import assert from "node:assert/strict";
import test from "node:test";
import { StreamableFile } from "@nestjs/common";

import { OpsReportsController } from "./ops-reports.controller";

test("OpsReportsController delegates preview, generation, history, and schedules with the authenticated user", async () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const controller = new OpsReportsController({
    preview: async (...args: unknown[]) => {
      calls.push({ method: "preview", args });
      return { title: "Informe", summary: [], charts: [], tables: [], findings: [] };
    },
    generate: async (...args: unknown[]) => {
      calls.push({ method: "generate", args });
      return { reportId: "report-1" };
    },
    listHistory: async (...args: unknown[]) => {
      calls.push({ method: "listHistory", args });
      return [{ id: "history-1" }];
    },
    createSchedule: async (...args: unknown[]) => {
      calls.push({ method: "createSchedule", args });
      return { id: "schedule-1" };
    },
    downloadArtifact: async (...args: unknown[]) => {
      calls.push({ method: "downloadArtifact", args });
      return { fileName: "monitoreo.pdf", mimeType: "application/pdf", buffer: Buffer.from("pdf") };
    },
  } as any);

  const previewDto = {
    reportType: "MONITORING" as const,
    filters: { dateFrom: "2026-07-01T00:00:00.000Z", dateTo: "2026-07-07T00:00:00.000Z" },
  };
  const scheduleDto = {
    ...previewDto,
    frequency: "WEEKLY" as const,
    titleTemplate: "Monitoreo semanal",
    relativeRange: { days: 7 },
  };
  const req = { user: { id: "user-1" } } as any;

  assert.deepEqual(await controller.preview(previewDto), { title: "Informe", summary: [], charts: [], tables: [], findings: [] });
  assert.deepEqual(await controller.generate(previewDto, req), { reportId: "report-1" });
  assert.deepEqual(await controller.listHistory("MONITORING"), [{ id: "history-1" }]);
  assert.deepEqual(await controller.createSchedule(scheduleDto, req), { id: "schedule-1" });
  const headers = new Map<string, string>();
  const download = await controller.downloadArtifact("report-1", "PDF", {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  } as any);
  assert.ok(download instanceof StreamableFile);
  assert.equal(headers.get("Content-Type"), "application/pdf");
  assert.equal(headers.get("Content-Disposition"), 'attachment; filename="monitoreo.pdf"');

  assert.deepEqual(calls, [
    { method: "preview", args: [previewDto] },
    { method: "generate", args: [previewDto, "user-1"] },
    { method: "listHistory", args: ["MONITORING"] },
    { method: "createSchedule", args: [scheduleDto, "user-1"] },
    { method: "downloadArtifact", args: ["report-1", "PDF"] },
  ]);
});
