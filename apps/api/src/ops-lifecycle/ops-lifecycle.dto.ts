import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateOpsSettingsDto {
  @IsString() @IsNotEmpty() backupRootPath!: string;
  @IsBoolean() automaticBackupEnabled!: boolean;
  @IsInt() @Min(0) @Max(23) automaticBackupHour!: number;
  @IsInt() @Min(1) @Max(90) automaticRetentionCount!: number;
}

export class CreateBackupDto {
  @IsIn(["AUTOMATIC", "MANUAL_PROTECTED", "PRE_UPDATE"]) kind!: "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE";
}

export class RestoreBackupDto {
  @IsString() @IsNotEmpty() backupPath!: string;
  @IsIn(["FULL_SYSTEM", "DATABASE_ONLY", "OBJECTS_ONLY", "CONFIG_ONLY"]) scope!: "FULL_SYSTEM" | "DATABASE_ONLY" | "OBJECTS_ONLY" | "CONFIG_ONLY";
}

export class ApplyOfflineUpdateDto {
  @IsString() @IsNotEmpty() packagePath!: string;
  @IsString() @IsNotEmpty() versionLabel!: string;
  @IsOptional() @IsString() notes?: string;
}
