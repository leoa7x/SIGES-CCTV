import assert from "node:assert/strict";
import test from "node:test";

import { OpsReportHistoryService } from "./ops-report-history.service";

test("createHistoricalReport stores PDF and CSV artifacts for an official cut", async () => {
  const uploads: Array<{ key: string; mimeType: string }> = [];
  const prisma = {
    opsReportDefinition: { create: async ({ data }: any) => ({ id: "report-1", ...data }) },
    opsReportArtifact: { createMany: async ({ data }: any) => data },
  };
  const storage = {
    uploadPrivateLikeHistorical: async (key: string, _buffer: Buffer, mimeType: string) => {
      uploads.push({ key, mimeType });
      return `http://minio.local/${key}`;
    },
  };

  const service = new OpsReportHistoryService(prisma as any, storage as any);
  const report = await service.createHistoricalReport({
    reportType: "MONITORING",
    title: "Monitoreo semanal",
    generatedByUserId: "user-1",
    trigger: "MANUAL",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    brandingSnapshot: { profileId: "brand-1", name: "SIGES" },
    pdf: { fileName: "monitoreo.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" },
    csv: { fileName: "monitoreo.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" },
  });

  assert.equal(report.id, "report-1");
  assert.deepEqual(uploads.map((item) => item.mimeType), ["application/pdf", "text/csv"]);
});
