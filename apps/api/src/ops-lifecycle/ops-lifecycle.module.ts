import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { OpsBackupService } from "./ops-backup.service";
import { OpsLifecycleController } from "./ops-lifecycle.controller";
import { OpsLifecycleService } from "./ops-lifecycle.service";
import { OpsRestoreService } from "./ops-restore.service";
import { OpsSchedulerService } from "./ops-scheduler.service";
import { OpsUpdateService } from "./ops-update.service";

@Module({
  imports: [PrismaModule],
  controllers: [OpsLifecycleController],
  providers: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
  exports: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
})
export class OpsLifecycleModule {}
