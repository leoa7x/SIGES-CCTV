import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { OpsReportFormat, OpsReportType, Permission } from "@prisma/client";
import { Request, Response } from "express";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateOpsReportScheduleDto, GenerateOpsReportDto, PreviewOpsReportDto } from "./ops-reports.dto";
import { OpsReportsService } from "./ops-reports.service";

type AuthenticatedRequest = Request & { user: { id: string } };

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("ops-lifecycle/reports")
export class OpsReportsController {
  constructor(private readonly service: OpsReportsService) {}

  @Get("history")
  @RequirePermissions(Permission.REPORTS_VIEW)
  listHistory(
    @Query("reportType", new ParseEnumPipe(OpsReportType, { optional: true })) reportType?: OpsReportType,
  ) {
    return this.service.listHistory(reportType);
  }

  @Post("preview")
  @RequirePermissions(Permission.REPORTS_VIEW)
  preview(@Body() dto: PreviewOpsReportDto) {
    return this.service.preview(dto);
  }

  @Post("generate")
  @RequirePermissions(Permission.REPORTS_CLOSE_PERIOD)
  generate(@Body() dto: GenerateOpsReportDto, @Req() req: AuthenticatedRequest) {
    return this.service.generate(dto, req.user.id);
  }

  @Post("schedules")
  @RequirePermissions(Permission.REPORTS_SCHEDULE)
  createSchedule(@Body() dto: CreateOpsReportScheduleDto, @Req() req: AuthenticatedRequest) {
    return this.service.createSchedule(dto, req.user.id);
  }

  @Get(":reportId/artifacts/:format/download")
  @RequirePermissions(Permission.REPORTS_EXPORT)
  async downloadArtifact(
    @Param("reportId") reportId: string,
    @Param("format", new ParseEnumPipe(OpsReportFormat)) format: OpsReportFormat,
    @Res({ passthrough: true }) res: Response,
  ) {
    const artifact = await this.service.downloadArtifact(reportId, format);
    res.setHeader("Content-Type", artifact.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${artifact.fileName}"`);
    return new StreamableFile(artifact.buffer);
  }
}
