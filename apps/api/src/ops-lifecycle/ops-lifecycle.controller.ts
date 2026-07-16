import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ApplyOfflineUpdateDto, CreateBackupDto, RestoreBackupDto, UpdateOpsSettingsDto } from "./ops-lifecycle.dto";
import { OpsLifecycleService } from "./ops-lifecycle.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("ops-lifecycle")
export class OpsLifecycleController {
  constructor(private readonly service: OpsLifecycleService) {}

  @Get()
  @RequirePermissions(Permission.MANAGE_ORG)
  getSummary() {
    return this.service.getSummary();
  }

  @Patch("settings")
  @RequirePermissions(Permission.MANAGE_ORG)
  updateSettings(@Body() dto: UpdateOpsSettingsDto) {
    return this.service.updateSettings(dto);
  }

  @Post("backups")
  @RequirePermissions(Permission.MANAGE_ORG)
  createBackup(@Body() dto: CreateBackupDto) {
    return this.service.createBackup(dto.kind);
  }

  @Post("restores")
  @RequirePermissions(Permission.MANAGE_ORG)
  restoreBackup(@Body() dto: RestoreBackupDto) {
    return this.service.restoreBackup(dto.scope, dto.backupPath);
  }

  @Post("updates")
  @RequirePermissions(Permission.MANAGE_ORG)
  applyOfflineUpdate(@Body() dto: ApplyOfflineUpdateDto) {
    return this.service.applyOfflineUpdate(dto);
  }
}
