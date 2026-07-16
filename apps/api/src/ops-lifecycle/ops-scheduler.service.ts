import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { OpsBackupService } from "./ops-backup.service";

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class OpsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private lastAutomaticRunKey = "";

  constructor(private readonly backupService: OpsBackupService, private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.runAutomaticBackupIfDue();
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runAutomaticBackupIfDue() {
    const settings = await this.prisma.opsLifecycleSettings.findFirst();
    if (!settings?.automaticBackupEnabled) return;

    const now = new Date();
    const runKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${settings.automaticBackupHour}`;
    if (now.getHours() !== settings.automaticBackupHour || this.lastAutomaticRunKey === runKey) return;

    this.lastAutomaticRunKey = runKey;
    await this.backupService.runBackup("AUTOMATIC");
  }
}
