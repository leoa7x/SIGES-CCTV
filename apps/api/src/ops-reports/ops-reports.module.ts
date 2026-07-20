import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";
import { IncidentsReportBuilder } from "./builders/incidents-report.builder";
import { InfrastructureReportBuilder } from "./builders/infrastructure-report.builder";
import { MonitoringReportBuilder } from "./builders/monitoring-report.builder";
import { OpsReportBrandingService } from "./ops-report-branding.service";
import { OpsReportHistoryService } from "./ops-report-history.service";
import { OpsReportRendererService } from "./ops-report-renderer.service";
import { OpsReportSchedulerService } from "./ops-report-scheduler.service";
import { OpsReportsService } from "./ops-reports.service";

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [
    MonitoringReportBuilder,
    InfrastructureReportBuilder,
    IncidentsReportBuilder,
    OpsReportBrandingService,
    OpsReportHistoryService,
    OpsReportRendererService,
    OpsReportsService,
    OpsReportSchedulerService,
  ],
  exports: [
    MonitoringReportBuilder,
    InfrastructureReportBuilder,
    IncidentsReportBuilder,
    OpsReportBrandingService,
    OpsReportHistoryService,
    OpsReportRendererService,
    OpsReportsService,
    OpsReportSchedulerService,
  ],
})
export class OpsReportsModule {}
