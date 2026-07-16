import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { OpsBackupService } from "./ops-backup.service";
import { OpsRestoreService } from "./ops-restore.service";
import { OpsLifecycleSummary } from "./ops-lifecycle.types";
import { OpsUpdateService } from "./ops-update.service";

@Injectable()
export class OpsLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupService: OpsBackupService,
    private readonly restoreService: OpsRestoreService,
    private readonly updateService: OpsUpdateService,
  ) {}

  async getSummary(): Promise<OpsLifecycleSummary> {
    const settings = await this.prisma.opsLifecycleSettings.findFirst();
    const lastBackup = await this.prisma.opsBackupRecord.findFirst({ orderBy: { createdAt: "desc" } });
    const lastUpdate = await this.prisma.opsUpdateRecord.findFirst({ orderBy: { createdAt: "desc" } });

    return {
      settings: {
        backupRootPath: settings?.backupRootPath ?? "",
        automaticBackupEnabled: settings?.automaticBackupEnabled ?? true,
        automaticBackupHour: settings?.automaticBackupHour ?? 23,
        automaticRetentionCount: settings?.automaticRetentionCount ?? 15,
      },
      lastBackup: lastBackup
        ? {
            id: lastBackup.id,
            createdAt: lastBackup.createdAt.toISOString(),
            kind: lastBackup.kind,
            status: lastBackup.status,
          }
        : null,
      lastUpdate: lastUpdate
        ? {
            id: lastUpdate.id,
            createdAt: lastUpdate.createdAt.toISOString(),
            versionLabel: lastUpdate.versionLabel,
            status: lastUpdate.status,
          }
        : null,
    };
  }

  async createBackup(kind: "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE") {
    return this.backupService.runBackup(kind);
  }

  async updateSettings(dto: {
    backupRootPath: string;
    automaticBackupEnabled: boolean;
    automaticBackupHour: number;
    automaticRetentionCount: number;
  }) {
    const current = await this.prisma.opsLifecycleSettings.findFirst();
    if (current) {
      return this.prisma.opsLifecycleSettings.update({ where: { id: current.id }, data: dto });
    }

    return this.prisma.opsLifecycleSettings.create({ data: dto });
  }

  async restoreBackup(scope: "FULL_SYSTEM" | "DATABASE_ONLY" | "OBJECTS_ONLY" | "CONFIG_ONLY", backupPath: string) {
    return this.restoreService.restoreBackup(scope, backupPath);
  }

  async applyOfflineUpdate(dto: { versionLabel: string; packagePath: string }) {
    return this.updateService.applyOfflineUpdate(dto);
  }
}
