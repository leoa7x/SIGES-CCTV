import { Injectable } from "@nestjs/common";
import { OpsReportSchedule, Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { IncidentsReportBuilder } from "./builders/incidents-report.builder";
import { InfrastructureReportBuilder } from "./builders/infrastructure-report.builder";
import { MonitoringReportBuilder } from "./builders/monitoring-report.builder";
import {
  CreateOpsReportScheduleDto,
  GenerateOpsReportDto,
  PreviewOpsReportDto,
} from "./ops-reports.dto";
import { OpsReportBrandingService } from "./ops-report-branding.service";
import { OpsReportHistoryService } from "./ops-report-history.service";
import { OpsReportRendererService } from "./ops-report-renderer.service";
import { OpsReportFilters, OpsReportType, ReportPreviewPayload } from "./ops-reports.types";

export type HistoricalReportListItem = {
  id: string;
  reportType: OpsReportType;
  title: string;
  dateFrom: Date;
  dateTo: Date;
  trigger: "MANUAL" | "SCHEDULED";
  createdAt: Date;
  artifacts: Array<{ format: "PDF" | "CSV"; fileName: string; publicUrl: string; mimeType: string }>;
};

type ScheduledReport = Pick<OpsReportSchedule, "reportType" | "titleTemplate" | "filtersJson" | "relativeRangeJson">;

@Injectable()
export class OpsReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringBuilder: MonitoringReportBuilder,
    private readonly infrastructureBuilder: InfrastructureReportBuilder,
    private readonly incidentsBuilder: IncidentsReportBuilder,
    private readonly renderer: OpsReportRendererService,
    private readonly history: OpsReportHistoryService,
    private readonly branding: OpsReportBrandingService,
  ) {}

  async preview(dto: PreviewOpsReportDto): Promise<ReportPreviewPayload> {
    switch (dto.reportType) {
      case "MONITORING": return this.monitoringBuilder.build(dto.filters);
      case "INFRASTRUCTURE": return this.infrastructureBuilder.build(dto.filters);
      case "INCIDENTS": return this.incidentsBuilder.build(dto.filters);
    }
  }

  async generate(dto: GenerateOpsReportDto, userId: string | null): Promise<{ reportId: string }> {
    return this.generateOfficialReport(dto, userId, "MANUAL");
  }

  async generateFromSchedule(schedule: ScheduledReport, now = new Date()): Promise<{ reportId: string }> {
    const filters = schedule.filtersJson as unknown as OpsReportFilters;
    const relativeRange = schedule.relativeRangeJson as unknown as { days: number };
    const dateTo = new Date(now);
    const dateFrom = new Date(now);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - relativeRange.days);

    const result = await this.generateOfficialReport({
      reportType: schedule.reportType,
      filters: {
        ...filters,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
    }, null, "SCHEDULED", schedule.titleTemplate);
    return result;
  }

  async listHistory(reportType?: OpsReportType): Promise<HistoricalReportListItem[]> {
    return this.prisma.opsReportDefinition.findMany({
      where: reportType ? { reportType } : undefined,
      select: {
        id: true,
        reportType: true,
        title: true,
        dateFrom: true,
        dateTo: true,
        trigger: true,
        createdAt: true,
        artifacts: {
          select: { format: true, fileName: true, publicUrl: true, mimeType: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createSchedule(dto: CreateOpsReportScheduleDto, userId: string | null): Promise<OpsReportSchedule> {
    return this.prisma.opsReportSchedule.create({
      data: {
        reportType: dto.reportType,
        frequency: dto.frequency,
        titleTemplate: dto.titleTemplate,
        filtersJson: dto.filters as unknown as Prisma.InputJsonValue,
        relativeRangeJson: dto.relativeRange as unknown as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    });
  }

  private async generateOfficialReport(
    dto: GenerateOpsReportDto,
    userId: string | null,
    trigger: "MANUAL" | "SCHEDULED",
    title?: string,
  ): Promise<{ reportId: string }> {
    const [payload, branding] = await Promise.all([
      this.preview(dto),
      this.branding.getActiveBrandingSnapshot(),
    ]);
    const officialPayload = title ? { ...payload, title } : payload;
    const [pdf, csv] = await Promise.all([
      this.renderer.renderPdf(officialPayload, branding),
      this.renderer.renderCsv(officialPayload),
    ]);
    const report = await this.history.createHistoricalReport({
      reportType: dto.reportType,
      title: officialPayload.title,
      generatedByUserId: userId,
      trigger,
      filters: dto.filters,
      brandingSnapshot: branding,
      pdf,
      csv,
    });
    return { reportId: report.id };
  }
}
