import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { OpsBackupService } from "./ops-backup.service";

@Injectable()
export class OpsUpdateService {
  constructor(private readonly prisma: PrismaService, private readonly backupService: OpsBackupService) {}

  async applyOfflineUpdate(input: { versionLabel: string; packagePath: string }) {
    const preUpdateBackup = await this.backupService.runBackup("PRE_UPDATE");
    const record = await this.prisma.opsUpdateRecord.create({
      data: {
        versionLabel: input.versionLabel,
        packagePath: input.packagePath,
        preUpdateBackupId: preUpdateBackup.id,
        status: "RUNNING",
      },
    });

    await this.prisma.opsUpdateRecord.update({
      where: { id: record.id },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });

    return { id: record.id, preUpdateBackupId: preUpdateBackup.id, status: "SUCCEEDED" as const };
  }
}
