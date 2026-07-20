import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { IncidentsReportBuilder } from "./builders/incidents-report.builder";
import { InfrastructureReportBuilder } from "./builders/infrastructure-report.builder";
import { MonitoringReportBuilder } from "./builders/monitoring-report.builder";
import { OpsReportBrandingService } from "./ops-report-branding.service";
import { OpsReportHistoryService } from "./ops-report-history.service";
import { OpsReportRendererService } from "./ops-report-renderer.service";
import { OpsReportSchedulerService } from "./ops-report-scheduler.service";
import { OpsReportsModule } from "./ops-reports.module";
import { OpsReportsService } from "./ops-reports.service";

test("OpsReportsModule resolves and exports the scheduler and report services", async () => {
  const module = await Test.createTestingModule({ imports: [OpsReportsModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(StorageService)
    .useValue({})
    .compile();

  assert.ok(module.get(OpsReportSchedulerService));
  assert.ok(module.get(OpsReportsService));
  assert.ok(module.get(OpsReportRendererService));
  assert.ok(module.get(OpsReportHistoryService));
  assert.ok(module.get(OpsReportBrandingService));
  assert.ok(module.get(MonitoringReportBuilder));
  assert.ok(module.get(InfrastructureReportBuilder));
  assert.ok(module.get(IncidentsReportBuilder));

  await module.close();
});
