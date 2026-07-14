import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class TotalsDto {
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) activeHosts!: number;
  @IsInt() @Min(0) activeFlows!: number;
}

class ProtocolDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class DestinationDto {
  @IsString() @IsNotEmpty() target!: string;
  @IsString() @IsIn(["IP", "DOMAIN", "ASN", "UNKNOWN"]) kind!: "IP" | "DOMAIN" | "ASN" | "UNKNOWN";
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class AssetSampleDto {
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) flowCount!: number;
  @IsISO8601() lastSeenAt!: string;
}

export class IngestNetworkTelemetryDto {
  @IsString() @IsNotEmpty() nodeId!: string;
  @IsString() @IsNotEmpty() collectorId!: string;
  @IsISO8601() capturedAt!: string;
  @IsInt() @Min(1) windowSeconds!: number;
  @ValidateNested() @Type(() => TotalsDto) totals!: TotalsDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProtocolDto) protocols!: ProtocolDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => DestinationDto) destinations!: DestinationDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => AssetSampleDto) assets!: AssetSampleDto[];
}
