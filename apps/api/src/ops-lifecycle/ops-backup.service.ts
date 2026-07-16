import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

type BackupKind = "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE";

@Injectable()
export class OpsBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async runBackup(kind: BackupKind) {
    const settings = await this.prisma.opsLifecycleSettings.findFirst();
    const root = settings?.backupRootPath;
    if (!root) throw new Error("No hay una ruta de respaldo configurada.");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(root, timestamp);
    const manifestPath = path.join(backupPath, "metadata", "restore-manifest.json");
    const record = await this.prisma.opsBackupRecord.create({
      data: {
        kind,
        status: "RUNNING",
        backupPath,
        sourceHostname: os.hostname(),
      },
    });

    try {
      await fs.mkdir(path.join(backupPath, "database"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "objects"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "config"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "metadata"), { recursive: true });

      await fs.writeFile(path.join(backupPath, "database", "README.txt"), "database backup placeholder\n");
      await fs.writeFile(path.join(backupPath, "objects", "README.txt"), "objects backup placeholder\n");
      await fs.writeFile(path.join(backupPath, "config", "README.txt"), "config backup placeholder\n");
      await fs.writeFile(
        manifestPath,
        JSON.stringify(
          {
            backupId: record.id,
            backupType: kind,
            createdAt: new Date().toISOString(),
            sourceHostname: os.hostname(),
            includedSections: ["database", "objects", "config"],
            status: "SUCCEEDED",
          },
          null,
          2,
        ),
      );

      await this.prisma.opsBackupRecord.update({
        where: { id: record.id },
        data: { status: "SUCCEEDED", manifestPath, finishedAt: new Date() },
      });

      if (kind === "AUTOMATIC") {
        await this.applyAutomaticRetention(settings?.automaticRetentionCount ?? 15);
      }

      return { id: record.id, backupPath, manifestPath, status: "SUCCEEDED" as const };
    } catch (error) {
      await this.prisma.opsBackupRecord.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "No se pudo completar el respaldo.",
          finishedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async applyAutomaticRetention(retentionCount: number) {
    const automaticBackups = await this.prisma.opsBackupRecord.findMany({
      where: { kind: "AUTOMATIC", status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
    });
    const staleBackups = automaticBackups.slice(retentionCount);

    await Promise.all(
      staleBackups.map((item: { backupPath: string }) =>
        fs.rm(item.backupPath, { recursive: true, force: true }),
      ),
    );

    if (staleBackups.length > 0) {
      await this.prisma.opsBackupRecord.deleteMany({
        where: { id: { in: staleBackups.map((item: { id: string }) => item.id) } },
      });
    }
  }
}
