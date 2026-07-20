import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import { OpsReportBrandingService } from "./ops-report-branding.service";
import { OpsReportHistoryService } from "./ops-report-history.service";
import { OpsReportsService } from "./ops-reports.service";
import {
  CreateOpsReportScheduleDto,
  GenerateOpsReportDto,
  PreviewOpsReportDto,
} from "./ops-reports.dto";

test("createHistoricalReport stores PDF and CSV artifacts for an official cut", async () => {
  const uploads: Array<{ key: string; mimeType: string }> = [];
  const artifactPayloads: unknown[] = [];
  const definitionPayloads: unknown[] = [];
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
    opsReportDefinition: {
      create: async ({ data }: any) => {
        definitionPayloads.push(data);
        return { id: data.id, ...data };
      },
    },
    opsReportArtifact: {
      createMany: async ({ data }: any) => {
        artifactPayloads.push(data);
        return data;
      },
    },
  };
  const storage = {
    uploadPrivateLikeHistorical: async (key: string, _buffer: Buffer, mimeType: string) => {
      uploads.push({ key, mimeType });
      return `private://${key}`;
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

  assert.match(report.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(uploads.map((item) => item.mimeType), ["application/pdf", "text/csv"]);
  assert.equal(definitionPayloads.length, 1);
  assert.deepEqual(artifactPayloads, [[
    {
      reportDefinitionId: report.id,
      format: "PDF",
      fileName: "monitoreo.pdf",
      storageKey: `reports/${report.id}/monitoreo.pdf`,
      publicUrl: `private://reports/${report.id}/monitoreo.pdf`,
      mimeType: "application/pdf",
    },
    {
      reportDefinitionId: report.id,
      format: "CSV",
      fileName: "monitoreo.csv",
      storageKey: `reports/${report.id}/monitoreo.csv`,
      publicUrl: `private://reports/${report.id}/monitoreo.csv`,
      mimeType: "text/csv",
    },
  ]]);
});

test("createHistoricalReport does not create an official cut when an artifact upload fails", async () => {
  let definitionCreates = 0;
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
    opsReportDefinition: { create: async () => { definitionCreates += 1; return { id: "report-1" }; } },
    opsReportArtifact: { createMany: async () => undefined },
  };
  const storage = {
    uploadPrivateLikeHistorical: async () => { throw new Error("storage unavailable"); },
  };

  const service = new OpsReportHistoryService(prisma as any, storage as any);

  await assert.rejects(
    service.createHistoricalReport({
      reportType: "MONITORING",
      title: "Monitoreo semanal",
      generatedByUserId: "user-1",
      trigger: "MANUAL",
      filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
      brandingSnapshot: { profileId: "brand-1", name: "SIGES" },
      pdf: { fileName: "monitoreo.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" },
      csv: { fileName: "monitoreo.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" },
    }),
    /storage unavailable/,
  );

  assert.equal(definitionCreates, 0);
});

test("createHistoricalReport rolls back the official cut when artifact persistence fails", async () => {
  const committedDefinitions: unknown[] = [];
  const uploadedKeys: string[] = [];
  const deletedKeys: string[] = [];
  const storage = {
    uploadPrivateLikeHistorical: async (key: string) => {
      uploadedKeys.push(key);
      return `private://${key}`;
    },
    deletePrivateHistorical: async (key: string) => { deletedKeys.push(key); },
  };
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const pendingDefinitions: unknown[] = [];
      try {
        const result = await callback({
          opsReportDefinition: {
            create: async ({ data }: any) => {
              pendingDefinitions.push(data);
              return { id: data.id, ...data };
            },
          },
          opsReportArtifact: { createMany: async () => { throw new Error("artifact persistence failed"); } },
        });
        committedDefinitions.push(...pendingDefinitions);
        return result;
      } catch (error) {
        throw error;
      }
    },
  };
  const service = new OpsReportHistoryService(prisma as any, storage as any);

  await assert.rejects(
    service.createHistoricalReport({
      reportType: "MONITORING",
      title: "Monitoreo semanal",
      generatedByUserId: "user-1",
      trigger: "MANUAL",
      filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
      brandingSnapshot: { profileId: "brand-1", name: "SIGES" },
      pdf: { fileName: "monitoreo.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" },
      csv: { fileName: "monitoreo.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" },
    }),
    /artifact persistence failed/,
  );

  assert.deepEqual(committedDefinitions, []);
  assert.deepEqual(deletedKeys.sort(), uploadedKeys.sort());
});

test("getActiveBrandingSnapshot captures the active branding fields", async () => {
  const service = new OpsReportBrandingService({
    brandingProfile: {
      findFirst: async () => ({
        id: "brand-1",
        name: "SIGES",
        logoUrl: "http://minio.local/logo.png",
        loginMessage: "Centro de monitoreo",
      }),
    },
  } as any);

  assert.deepEqual(await service.getActiveBrandingSnapshot(), {
    profileId: "brand-1",
    name: "SIGES",
    logoUrl: "http://minio.local/logo.png",
    loginMessage: "Centro de monitoreo",
  });
});

test("getActiveBrandingSnapshot rejects when no active profile exists", async () => {
  const service = new OpsReportBrandingService({
    brandingProfile: { findFirst: async () => null },
  } as any);

  await assert.rejects(service.getActiveBrandingSnapshot(), /No active branding profile/);
});

test("report DTOs accept complete valid requests", () => {
  const preview = plainToInstance(PreviewOpsReportDto, {
    reportType: "MONITORING",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07", severity: "HIGH" },
  });
  const generate = plainToInstance(GenerateOpsReportDto, {
    reportType: "INCIDENTS",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
  });
  const schedule = plainToInstance(CreateOpsReportScheduleDto, {
    reportType: "INFRASTRUCTURE",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    frequency: "WEEKLY",
    titleTemplate: "Infraestructura semanal",
    relativeRange: { days: 7 },
  });

  assert.equal(validateSync(preview).length, 0);
  assert.equal(validateSync(generate).length, 0);
  assert.equal(validateSync(schedule).length, 0);
});

test("report DTOs reject invalid report types and schedule ranges", () => {
  const generate = plainToInstance(GenerateOpsReportDto, {
    reportType: "INVALID",
    filters: { dateFrom: "invalid", dateTo: "2026-07-07" },
  });
  const schedule = plainToInstance(CreateOpsReportScheduleDto, {
    reportType: "MONITORING",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    frequency: "DAILY",
    titleTemplate: "",
    relativeRange: { days: 0 },
  });

  assert.ok(validateSync(generate).length > 0);
  assert.ok(validateSync(schedule).length > 0);
});

test("report DTOs require nested filters and schedule relative ranges", () => {
  const preview = plainToInstance(PreviewOpsReportDto, { reportType: "MONITORING" });
  const schedule = plainToInstance(CreateOpsReportScheduleDto, {
    reportType: "MONITORING",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    frequency: "WEEKLY",
    titleTemplate: "Monitoreo semanal",
  });

  assert.ok(validateSync(preview).some((error) => error.property === "filters"));
  assert.ok(validateSync(schedule).some((error) => error.property === "relativeRange"));
});

test("OpsReportsService dispatches previews and persists branded official artifacts", async () => {
  let persisted: any;
  const payload = { title: "Informe de monitoreo", summary: [], charts: [], tables: [], findings: [] };
  const service = new OpsReportsService(
    {} as any,
    { build: async () => payload } as any,
    { build: async () => { throw new Error("wrong builder"); } } as any,
    { build: async () => { throw new Error("wrong builder"); } } as any,
    {
      renderPdf: async () => ({ fileName: "report.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" }),
      renderCsv: async () => ({ fileName: "report.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" }),
    } as any,
    { createHistoricalReport: async (input: unknown) => { persisted = input; return { id: "report-1" }; } } as any,
    { getActiveBrandingSnapshot: async () => ({ profileId: "brand-1", name: "SIGES", logoUrl: null, loginMessage: null }) } as any,
  );
  const dto = { reportType: "MONITORING" as const, filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" } };

  assert.deepEqual(await service.preview(dto), payload);
  assert.deepEqual(await service.generate(dto, "user-1"), { reportId: "report-1" });
  assert.equal(persisted.trigger, "MANUAL");
  assert.equal(persisted.generatedByUserId, "user-1");
  assert.equal(persisted.brandingSnapshot.name, "SIGES");
});

test("OpsReportsService creates schedules and lists report history", async () => {
  const created: any[] = [];
  const service = new OpsReportsService(
    {
      opsReportSchedule: { create: async ({ data }: any) => { created.push(data); return { id: "schedule-1", ...data }; } },
      opsReportDefinition: { findMany: async () => [{ id: "report-1", reportType: "MONITORING", artifacts: [] }] },
    } as any,
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  const schedule = await service.createSchedule({
    reportType: "MONITORING",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    frequency: "WEEKLY",
    titleTemplate: "Monitoreo semanal",
    relativeRange: { days: 7 },
  }, "user-1");

  assert.equal(schedule.id, "schedule-1");
  assert.equal(created[0].createdByUserId, "user-1");
  assert.deepEqual(await service.listHistory("MONITORING"), [{ id: "report-1", reportType: "MONITORING", artifacts: [] }]);
});
