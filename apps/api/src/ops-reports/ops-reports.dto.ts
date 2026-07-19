import { Type } from "class-transformer";
import { IsDateString, IsDefined, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

const REPORT_TYPES = ["MONITORING", "INFRASTRUCTURE", "INCIDENTS"] as const;
const SCHEDULE_FREQUENCIES = ["WEEKLY", "MONTHLY"] as const;

export class OpsReportFiltersDto {
  @IsDateString() dateFrom!: string;
  @IsDateString() dateTo!: string;
  @IsOptional() @IsString() cityId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() centerId?: string | null;
  @IsOptional() @IsString() nodeId?: string | null;
  @IsOptional() @IsString() severity?: string | null;
  @IsOptional() @IsString() state?: string | null;
}

export class PreviewOpsReportDto {
  @IsIn(REPORT_TYPES) reportType!: (typeof REPORT_TYPES)[number];
  @IsDefined()
  @ValidateNested() @Type(() => OpsReportFiltersDto) filters!: OpsReportFiltersDto;
}

export class GenerateOpsReportDto extends PreviewOpsReportDto {}

export class OpsReportRelativeRangeDto {
  @IsInt() @Min(1) days!: number;
}

export class CreateOpsReportScheduleDto extends PreviewOpsReportDto {
  @IsIn(SCHEDULE_FREQUENCIES) frequency!: (typeof SCHEDULE_FREQUENCIES)[number];
  @IsString() @IsNotEmpty() titleTemplate!: string;
  @IsDefined()
  @ValidateNested() @Type(() => OpsReportRelativeRangeDto) relativeRange!: OpsReportRelativeRangeDto;
}
