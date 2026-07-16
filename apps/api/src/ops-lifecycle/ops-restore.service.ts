import fs from "node:fs/promises";
import path from "node:path";

import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

type RestoreScope = "FULL_SYSTEM" | "DATABASE_ONLY" | "OBJECTS_ONLY" | "CONFIG_ONLY";

@Injectable()
export class OpsRestoreService {
  constructor(private readonly prisma: PrismaService) {}

  async restoreBackup(scope: RestoreScope, backupPath: string) {
    const manifestPath = path.join(backupPath, "metadata", "restore-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as { status?: string };

    if (manifest.status !== "SUCCEEDED") {
      throw new BadRequestException("El respaldo seleccionado no está completo.");
    }

    const record = await this.prisma.opsRestoreRecord.create({
      data: { scope, status: "RUNNING", backupPath },
    });

    await this.prisma.opsRestoreRecord.update({
      where: { id: record.id },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });

    return { id: record.id, status: "SUCCEEDED" as const };
  }
}
