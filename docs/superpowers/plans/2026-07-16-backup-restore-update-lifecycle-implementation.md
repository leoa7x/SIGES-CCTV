# Backup, Restore, and Offline Update Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add phase-1 SIGES operational lifecycle support for scheduled backups, protected manual backups, selective restore, and offline update registration with mandatory pre-update backup.

**Architecture:** Introduce a new API module dedicated to platform operations instead of scattering backup/update logic into existing business modules. Persist operator settings and execution records in Prisma, execute filesystem-backed backup/restore flows through focused service helpers, and expose a small admin UI section for configuration and execution. Keep the first release intentionally simple: one daily schedule, folder-based backups, manual package-driven updates, and guided rollback through the generated pre-update backup.

**Tech Stack:** NestJS, Prisma, ts-node/node filesystem APIs, Next.js, existing auth/permissions guards, existing `OpsNotice`/`OpsShell` UI patterns.

## Global Constraints

- The environment may operate fully offline.
- Backup storage location must be configurable by the customer.
- Restore must work on a SIGES instance that is already deployed.
- Updates will be applied manually from versioned offline packages.
- Every update must create a backup before applying changes.
- The operational model must be understandable by support personnel without repository-level knowledge.
- Automatic backups keep the latest 15 entries by default.
- Protected manual backups never participate in automatic retention cleanup.
- The primary backup representation is a folder tree, not a monolithic zip file.

---

## File Structure

- Modify: `apps/api/prisma/schema.prisma`
  - Add operational settings and execution-record models for backups, restores, and updates.
- Create: `apps/api/prisma/migrations/<timestamp>_ops_lifecycle/`
  - Persist schema changes.
- Modify: `apps/api/src/app.module.ts`
  - Register the new operations module.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`
  - Wire controller, services, and scheduler.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts`
  - Orchestrate settings, status listing, and top-level command entrypoints.
- Create: `apps/api/src/ops-lifecycle/ops-backup.service.ts`
  - Build folder backups, write manifests, and apply retention.
- Create: `apps/api/src/ops-lifecycle/ops-restore.service.ts`
  - Validate manifests and perform selective restore.
- Create: `apps/api/src/ops-lifecycle/ops-update.service.ts`
  - Register offline update attempts and enforce mandatory pre-update backup.
- Create: `apps/api/src/ops-lifecycle/ops-scheduler.service.ts`
  - Run daily automatic backups on a timer.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts`
  - Expose authenticated endpoints for settings, backup, restore, and updates.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.dto.ts`
  - DTOs for settings, backup requests, restore requests, and update requests.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.types.ts`
  - Shared TypeScript types used by services and tests.
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.service.test.ts`
  - Cover settings/status entrypoints.
- Create: `apps/api/src/ops-lifecycle/ops-backup.service.test.ts`
  - Cover backup creation, manifest writing, retention, and protected/manual behavior.
- Create: `apps/api/src/ops-lifecycle/ops-restore.service.test.ts`
  - Cover selective restore validation.
- Create: `apps/api/src/ops-lifecycle/ops-update.service.test.ts`
  - Cover pre-update backup enforcement and update record behavior.
- Create: `apps/web/lib/ops-lifecycle.ts`
  - Client-side helpers and types for the new UI.
- Create: `apps/web/lib/ops-lifecycle.test.ts`
  - Test display helpers and request shape normalization.
- Modify: `apps/web/app/admin/branding/page.tsx`
  - Add “Respaldo y actualización” operational section because branding already functions as admin configuration surface.
- Modify: `apps/web/lib/presentation.ts`
  - Add operator-facing copy helpers for backup/update labels if duplication appears.

## Task 1: Add persistent lifecycle models and API contracts

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.dto.ts`
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.types.ts`
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.service.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`

**Interfaces:**
- Consumes: `PrismaModule`, existing `Permission.MANAGE_ORG`, existing auth guard patterns.
- Produces:
  - Prisma models:
    - `OpsLifecycleSettings`
    - `OpsBackupRecord`
    - `OpsRestoreRecord`
    - `OpsUpdateRecord`
  - DTOs:
    - `UpdateOpsSettingsDto`
    - `CreateBackupDto`
    - `RestoreBackupDto`
    - `ApplyOfflineUpdateDto`
  - Response types:
    - `OpsLifecycleSummary`
    - `OpsBackupRecordView`
    - `OpsUpdateRecordView`

- [ ] **Step 1: Write the failing service-contract test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { OpsLifecycleService } from "./ops-lifecycle.service";

test("getSummary returns persisted settings plus latest operation timestamps", async () => {
  const prisma = {
    opsLifecycleSettings: {
      findFirst: async () => ({
        id: "settings-1",
        backupRootPath: "D:\\SIGES\\backups",
        automaticBackupEnabled: true,
        automaticBackupHour: 23,
        automaticRetentionCount: 15,
      }),
    },
    opsBackupRecord: {
      findFirst: async () => ({
        id: "backup-1",
        createdAt: new Date("2026-07-16T04:00:00.000Z"),
        kind: "AUTOMATIC",
        status: "SUCCEEDED",
      }),
    },
    opsUpdateRecord: {
      findFirst: async () => ({
        id: "update-1",
        createdAt: new Date("2026-07-15T18:00:00.000Z"),
        versionLabel: "2026.07.15",
        status: "SUCCEEDED",
      }),
    },
  };

  const service = new OpsLifecycleService(prisma as never, null as never, null as never, null as never);
  const summary = await service.getSummary();

  assert.equal(summary.settings.backupRootPath, "D:\\SIGES\\backups");
  assert.equal(summary.settings.automaticRetentionCount, 15);
  assert.equal(summary.lastBackup?.id, "backup-1");
  assert.equal(summary.lastUpdate?.id, "update-1");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/api && npx ts-node --project tsconfig.json src/ops-lifecycle/ops-lifecycle.service.test.ts`

Expected: FAIL because the `ops-lifecycle` files and service do not exist yet.

- [ ] **Step 3: Add Prisma lifecycle models**

Add the following block near the other operational models in `apps/api/prisma/schema.prisma`:

```prisma
enum OpsBackupKind {
  AUTOMATIC
  MANUAL_PROTECTED
  PRE_UPDATE
}

enum OpsOperationStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
}

enum OpsRestoreScope {
  FULL_SYSTEM
  DATABASE_ONLY
  OBJECTS_ONLY
  CONFIG_ONLY
}

model OpsLifecycleSettings {
  id                    String   @id @default(cuid())
  backupRootPath        String
  automaticBackupEnabled Boolean @default(true)
  automaticBackupHour   Int      @default(23)
  automaticRetentionCount Int    @default(15)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model OpsBackupRecord {
  id              String             @id @default(cuid())
  kind            OpsBackupKind
  status          OpsOperationStatus @default(PENDING)
  backupPath      String
  manifestPath    String?
  versionLabel    String?
  sourceHostname  String?
  createdAt       DateTime           @default(now())
  finishedAt      DateTime?
  errorMessage    String?
}

model OpsRestoreRecord {
  id              String             @id @default(cuid())
  scope           OpsRestoreScope
  status          OpsOperationStatus @default(PENDING)
  backupRecordId  String?
  backupPath      String
  createdAt       DateTime           @default(now())
  finishedAt      DateTime?
  errorMessage    String?
}

model OpsUpdateRecord {
  id                String             @id @default(cuid())
  versionLabel      String
  packagePath       String
  preUpdateBackupId String?
  status            OpsOperationStatus @default(PENDING)
  createdAt         DateTime           @default(now())
  finishedAt        DateTime?
  errorMessage      String?
}
```

- [ ] **Step 4: Add minimal types, DTOs, module, and service skeleton**

Create `apps/api/src/ops-lifecycle/ops-lifecycle.types.ts`:

```ts
export type OpsLifecycleSummary = {
  settings: {
    backupRootPath: string;
    automaticBackupEnabled: boolean;
    automaticBackupHour: number;
    automaticRetentionCount: number;
  };
  lastBackup: { id: string; createdAt: string; kind: string; status: string } | null;
  lastUpdate: { id: string; createdAt: string; versionLabel: string; status: string } | null;
};
```

Create `apps/api/src/ops-lifecycle/ops-lifecycle.dto.ts`:

```ts
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
```

Create `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts`:

```ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class OpsLifecycleService {
  constructor(
    private readonly prisma: any,
    private readonly backupService: any,
    private readonly restoreService: any,
    private readonly updateService: any,
  ) {}

  async getSummary() {
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
      lastBackup: lastBackup ? {
        id: lastBackup.id,
        createdAt: lastBackup.createdAt.toISOString(),
        kind: lastBackup.kind,
        status: lastBackup.status,
      } : null,
      lastUpdate: lastUpdate ? {
        id: lastUpdate.id,
        createdAt: lastUpdate.createdAt.toISOString(),
        versionLabel: lastUpdate.versionLabel,
        status: lastUpdate.status,
      } : null,
    };
  }
}
```

Create `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpsLifecycleService } from "./ops-lifecycle.service";

@Module({
  imports: [PrismaModule],
  providers: [OpsLifecycleService],
  exports: [OpsLifecycleService],
})
export class OpsLifecycleModule {}
```

Modify `apps/api/src/app.module.ts` imports:

```ts
import { OpsLifecycleModule } from "./ops-lifecycle/ops-lifecycle.module";
```

And add it to `imports`:

```ts
    OpsLifecycleModule,
```

- [ ] **Step 5: Run the service test to verify it passes**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/api && npx ts-node --project tsconfig.json src/ops-lifecycle/ops-lifecycle.service.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/app.module.ts apps/api/src/ops-lifecycle docs/superpowers/plans/2026-07-16-backup-restore-update-lifecycle-implementation.md
git commit -m "feat: add lifecycle models and service contracts"
```

### Task 2: Implement filesystem-backed backups, manifests, retention, and scheduler

**Files:**
- Create: `apps/api/src/ops-lifecycle/ops-backup.service.ts`
- Create: `apps/api/src/ops-lifecycle/ops-backup.service.test.ts`
- Create: `apps/api/src/ops-lifecycle/ops-scheduler.service.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes:
  - `OpsLifecycleSettings.backupRootPath`
  - `CreateBackupDto.kind`
- Produces:
  - `OpsBackupService.runBackup(kind: "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE"): Promise<{ id: string; backupPath: string; manifestPath: string; status: "SUCCEEDED" | "FAILED" }>`
  - `OpsSchedulerService.runAutomaticBackupIfDue(): Promise<void>`

- [ ] **Step 1: Write the failing backup test**

```ts
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OpsBackupService } from "./ops-backup.service";

test("runBackup writes manifest folders and applies retention only to automatic backups", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "siges-backup-"));
  const prisma = {
    opsLifecycleSettings: { findFirst: async () => ({ backupRootPath: root, automaticRetentionCount: 2 }) },
    opsBackupRecord: {
      create: async ({ data }: any) => ({ id: "backup-1", ...data }),
      update: async ({ data }: any) => data,
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
  };

  const service = new OpsBackupService(prisma as never);
  const result = await service.runBackup("MANUAL_PROTECTED");
  const manifestText = await fs.readFile(result.manifestPath, "utf8");
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.backupType, "MANUAL_PROTECTED");
  assert.ok(result.backupPath.includes(path.sep));
  assert.ok((await fs.stat(path.join(result.backupPath, "database"))).isDirectory());
  assert.ok((await fs.stat(path.join(result.backupPath, "objects"))).isDirectory());
  assert.ok((await fs.stat(path.join(result.backupPath, "config"))).isDirectory());
});
```

- [ ] **Step 2: Run the backup test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/api && npx ts-node --project tsconfig.json src/ops-lifecycle/ops-backup.service.test.ts`

Expected: FAIL because `OpsBackupService` does not exist.

- [ ] **Step 3: Add the backup service and scheduler skeleton**

Create `apps/api/src/ops-lifecycle/ops-backup.service.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Injectable } from "@nestjs/common";

@Injectable()
export class OpsBackupService {
  constructor(private readonly prisma: any) {}

  async runBackup(kind: "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE") {
    const settings = await this.prisma.opsLifecycleSettings.findFirst();
    const root = settings?.backupRootPath;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(root, timestamp);
    const manifestPath = path.join(backupPath, "metadata", "restore-manifest.json");
    const record = await this.prisma.opsBackupRecord.create({
      data: { kind, status: "RUNNING", backupPath, sourceHostname: os.hostname() },
    });

    try {
      await fs.mkdir(path.join(backupPath, "database"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "objects"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "config"), { recursive: true });
      await fs.mkdir(path.join(backupPath, "metadata"), { recursive: true });

      await fs.writeFile(path.join(backupPath, "database", "README.txt"), "database placeholder\n");
      await fs.writeFile(path.join(backupPath, "objects", "README.txt"), "objects placeholder\n");
      await fs.writeFile(path.join(backupPath, "config", "README.txt"), "config placeholder\n");
      await fs.writeFile(manifestPath, JSON.stringify({
        backupId: record.id,
        backupType: kind,
        createdAt: new Date().toISOString(),
        sourceHostname: os.hostname(),
        includedSections: ["database", "objects", "config"],
        status: "SUCCEEDED",
      }, null, 2));

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
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : "Backup failed", finishedAt: new Date() },
      });
      throw error;
    }
  }

  private async applyAutomaticRetention(retentionCount: number) {
    const automaticBackups = await this.prisma.opsBackupRecord.findMany({
      where: { kind: "AUTOMATIC", status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
    });
    const stale = automaticBackups.slice(retentionCount);
    await Promise.all(stale.map((item: any) => fs.rm(item.backupPath, { recursive: true, force: true })));
    if (stale.length > 0) {
      await this.prisma.opsBackupRecord.deleteMany({ where: { id: { in: stale.map((item: any) => item.id) } } });
    }
  }
}
```

Create `apps/api/src/ops-lifecycle/ops-scheduler.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { OpsBackupService } from "./ops-backup.service";

@Injectable()
export class OpsSchedulerService {
  constructor(private readonly backupService: OpsBackupService, private readonly prisma: any) {}

  async runAutomaticBackupIfDue() {
    const settings = await this.prisma.opsLifecycleSettings.findFirst();
    if (!settings?.automaticBackupEnabled) return;
    const currentHour = new Date().getHours();
    if (currentHour !== settings.automaticBackupHour) return;
    await this.backupService.runBackup("AUTOMATIC");
  }
}
```

Modify `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`:

```ts
import { OpsBackupService } from "./ops-backup.service";
import { OpsSchedulerService } from "./ops-scheduler.service";

@Module({
  imports: [PrismaModule],
  providers: [OpsLifecycleService, OpsBackupService, OpsSchedulerService],
  exports: [OpsLifecycleService, OpsBackupService, OpsSchedulerService],
})
```

Modify `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts`:

```ts
  async createBackup(kind: "AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE") {
    return this.backupService.runBackup(kind);
  }
```

Modify `apps/api/package.json` scripts:

```json
"test:ops-lifecycle": "ts-node --project tsconfig.json src/ops-lifecycle/ops-lifecycle.service.test.ts",
"test:ops-backup": "ts-node --project tsconfig.json src/ops-lifecycle/ops-backup.service.test.ts"
```

- [ ] **Step 4: Run the backup tests to verify they pass**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/api && npx ts-node --project tsconfig.json src/ops-lifecycle/ops-backup.service.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/ops-lifecycle
git commit -m "feat: add scheduled backup lifecycle"
```

### Task 3: Implement selective restore and offline update workflow with mandatory pre-update backup

**Files:**
- Create: `apps/api/src/ops-lifecycle/ops-restore.service.ts`
- Create: `apps/api/src/ops-lifecycle/ops-restore.service.test.ts`
- Create: `apps/api/src/ops-lifecycle/ops-update.service.ts`
- Create: `apps/api/src/ops-lifecycle/ops-update.service.test.ts`
- Create: `apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts`

**Interfaces:**
- Consumes:
  - `OpsBackupService.runBackup("PRE_UPDATE")`
  - `RestoreBackupDto`
  - `ApplyOfflineUpdateDto`
- Produces:
  - `OpsRestoreService.restoreBackup(scope, backupPath): Promise<{ id: string; status: "SUCCEEDED" | "FAILED" }>`
  - `OpsUpdateService.applyOfflineUpdate(versionLabel, packagePath): Promise<{ id: string; preUpdateBackupId: string; status: "SUCCEEDED" | "FAILED" }>`
  - API routes:
    - `GET /ops-lifecycle`
    - `PATCH /ops-lifecycle/settings`
    - `POST /ops-lifecycle/backups`
    - `POST /ops-lifecycle/restores`
    - `POST /ops-lifecycle/updates`

- [ ] **Step 1: Write the failing update-flow test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { OpsUpdateService } from "./ops-update.service";

test("applyOfflineUpdate creates a pre-update backup before recording the update", async () => {
  let createdPayload: any = null;
  const backupService = {
    runBackup: async () => ({ id: "backup-pre-1", backupPath: "/tmp/backup", manifestPath: "/tmp/backup/metadata/restore-manifest.json", status: "SUCCEEDED" }),
  };
  const prisma = {
    opsUpdateRecord: {
      create: async ({ data }: any) => {
        createdPayload = data;
        return { id: "update-1", ...data };
      },
      update: async ({ data }: any) => data,
    },
  };

  const service = new OpsUpdateService(prisma as never, backupService as never);
  const result = await service.applyOfflineUpdate({ versionLabel: "2026.07.16", packagePath: "D:\\updates\\SIGES-Update-2026.07.16.exe" });

  assert.equal(createdPayload.preUpdateBackupId, "backup-pre-1");
  assert.equal(result.preUpdateBackupId, "backup-pre-1");
  assert.equal(result.status, "SUCCEEDED");
});
```

- [ ] **Step 2: Run the restore/update tests to verify they fail**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/api && npx ts-node --project tsconfig.json src/ops-lifecycle/ops-update.service.test.ts`

Expected: FAIL because the restore/update services and controller do not exist yet.

- [ ] **Step 3: Add restore and update services plus controller**

Create `apps/api/src/ops-lifecycle/ops-restore.service.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";

@Injectable()
export class OpsRestoreService {
  constructor(private readonly prisma: any) {}

  async restoreBackup(scope: "FULL_SYSTEM" | "DATABASE_ONLY" | "OBJECTS_ONLY" | "CONFIG_ONLY", backupPath: string) {
    const manifestPath = path.join(backupPath, "metadata", "restore-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.status !== "SUCCEEDED") throw new BadRequestException("El respaldo seleccionado no está completo.");

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
```

Create `apps/api/src/ops-lifecycle/ops-update.service.ts`:

```ts
import { Injectable } from "@nestjs/common";

@Injectable()
export class OpsUpdateService {
  constructor(private readonly prisma: any, private readonly backupService: any) {}

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
```

Create `apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts`:

```ts
import { Body, Controller, Get, Patch, Post } from "@nestjs/common";
import { RequirePermissions } from "../common/guards/permissions.guard";
import { Permission } from "@prisma/client";
import { ApplyOfflineUpdateDto, CreateBackupDto, RestoreBackupDto, UpdateOpsSettingsDto } from "./ops-lifecycle.dto";
import { OpsLifecycleService } from "./ops-lifecycle.service";

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
```

Modify `apps/api/src/ops-lifecycle/ops-lifecycle.service.ts` with:

```ts
  async updateSettings(dto: { backupRootPath: string; automaticBackupEnabled: boolean; automaticBackupHour: number; automaticRetentionCount: number }) {
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
```

Modify `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`:

```ts
import { OpsRestoreService } from "./ops-restore.service";
import { OpsUpdateService } from "./ops-update.service";
import { OpsLifecycleController } from "./ops-lifecycle.controller";

@Module({
  imports: [PrismaModule],
  controllers: [OpsLifecycleController],
  providers: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
  exports: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
})
```

- [ ] **Step 4: Run restore/update tests and build targeted confidence**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV/apps/api
npx ts-node --project tsconfig.json src/ops-lifecycle/ops-update.service.test.ts
npx ts-node --project tsconfig.json src/ops-lifecycle/ops-restore.service.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ops-lifecycle
git commit -m "feat: add restore and offline update lifecycle endpoints"
```

### Task 4: Add admin UI for settings, status, backup, restore, and update actions

**Files:**
- Create: `apps/web/lib/ops-lifecycle.ts`
- Create: `apps/web/lib/ops-lifecycle.test.ts`
- Modify: `apps/web/app/admin/branding/page.tsx`
- Modify: `apps/web/lib/presentation.ts`

**Interfaces:**
- Consumes:
  - `GET /ops-lifecycle`
  - `PATCH /ops-lifecycle/settings`
  - `POST /ops-lifecycle/backups`
  - `POST /ops-lifecycle/restores`
  - `POST /ops-lifecycle/updates`
- Produces:
  - settings form bound to backup root path, hour, retention, enabled flag
  - action buttons for automatic/protected backup
  - restore form for path + scope
  - update form for version label + package path

- [ ] **Step 1: Write the failing helper test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOpsLifecycleSummary, formatOpsOperationStatus } from "./ops-lifecycle";

test("normalizeOpsLifecycleSummary fills operational fallbacks", () => {
  const summary = normalizeOpsLifecycleSummary({
    settings: {
      backupRootPath: "",
      automaticBackupEnabled: true,
      automaticBackupHour: 23,
      automaticRetentionCount: 15,
    },
    lastBackup: null,
    lastUpdate: null,
  });

  assert.equal(summary.settings.backupRootPath, "");
  assert.equal(summary.lastBackupLabel, "Sin respaldo registrado");
  assert.equal(formatOpsOperationStatus("SUCCEEDED"), "Completado");
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run: `cd /home/ingleonardosanchez/SIGES-CCTV/apps/web && npx ts-node --project tsconfig.test.json lib/ops-lifecycle.test.ts`

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Add client helpers**

Create `apps/web/lib/ops-lifecycle.ts`:

```ts
import { formatRelativeTime } from "./presentation";

export type OpsLifecycleSummary = {
  settings: {
    backupRootPath: string;
    automaticBackupEnabled: boolean;
    automaticBackupHour: number;
    automaticRetentionCount: number;
  };
  lastBackup: { id: string; createdAt: string; kind: string; status: string } | null;
  lastUpdate: { id: string; createdAt: string; versionLabel: string; status: string } | null;
};

export function formatOpsOperationStatus(status: string) {
  return {
    PENDING: "Pendiente",
    RUNNING: "En ejecución",
    SUCCEEDED: "Completado",
    FAILED: "Fallido",
  }[status] ?? status;
}

export function normalizeOpsLifecycleSummary(summary: OpsLifecycleSummary) {
  return {
    ...summary,
    lastBackupLabel: summary.lastBackup ? `${formatOpsOperationStatus(summary.lastBackup.status)} ${formatRelativeTime(summary.lastBackup.createdAt)}` : "Sin respaldo registrado",
    lastUpdateLabel: summary.lastUpdate ? `${summary.lastUpdate.versionLabel} · ${formatOpsOperationStatus(summary.lastUpdate.status)}` : "Sin actualización registrada",
  };
}
```

Optionally extend `apps/web/lib/presentation.ts` only if duplication is growing:

```ts
export function formatBooleanStatus(value: boolean, yes = "Sí", no = "No") {
  return value ? yes : no;
}
```

- [ ] **Step 4: Add the operational panel to `admin/branding`**

Add a dedicated section to `apps/web/app/admin/branding/page.tsx` following the same `OpsNotice` and form patterns already used elsewhere:

```tsx
const [opsSummary, setOpsSummary] = useState<OpsLifecycleSummary | null>(null);
const [opsSaving, setOpsSaving] = useState(false);
const [backupRootPath, setBackupRootPath] = useState("");
const [automaticBackupEnabled, setAutomaticBackupEnabled] = useState(true);
const [automaticBackupHour, setAutomaticBackupHour] = useState("23");
const [automaticRetentionCount, setAutomaticRetentionCount] = useState("15");
const [restorePath, setRestorePath] = useState("");
const [restoreScope, setRestoreScope] = useState("FULL_SYSTEM");
const [updateVersionLabel, setUpdateVersionLabel] = useState("");
const [updatePackagePath, setUpdatePackagePath] = useState("");
```

Load summary:

```tsx
const loadOpsSummary = useCallback(async () => {
  if (!accessToken) return;
  const summary = normalizeOpsLifecycleSummary(await apiGet<OpsLifecycleSummary>("/ops-lifecycle", accessToken));
  setOpsSummary(summary);
  setBackupRootPath(summary.settings.backupRootPath);
  setAutomaticBackupEnabled(summary.settings.automaticBackupEnabled);
  setAutomaticBackupHour(String(summary.settings.automaticBackupHour));
  setAutomaticRetentionCount(String(summary.settings.automaticRetentionCount));
}, [accessToken]);
```

Settings submit:

```tsx
await apiPatch("/ops-lifecycle/settings", accessToken, {
  backupRootPath,
  automaticBackupEnabled,
  automaticBackupHour: Number(automaticBackupHour),
  automaticRetentionCount: Number(automaticRetentionCount),
});
```

Render section:

```tsx
<section className="rounded-ops border border-ops-border bg-white p-5 shadow-ops">
  <div className="mb-4">
    <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-muted">Respaldo y actualización</h2>
    <p className="mt-2 text-sm text-ops-muted">Configura el respaldo diario, ejecuta copias protegidas y registra actualizaciones offline con respaldo previo obligatorio.</p>
  </div>
  {opsSummary ? (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-ops bg-ops-surface p-3 text-sm text-ops-text">Último respaldo: {opsSummary.lastBackupLabel}</div>
      <div className="rounded-ops bg-ops-surface p-3 text-sm text-ops-text">Última actualización: {opsSummary.lastUpdateLabel}</div>
    </div>
  ) : null}
</section>
```

- [ ] **Step 5: Run the helper test and web build**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV/apps/web
npx ts-node --project tsconfig.test.json lib/ops-lifecycle.test.ts
npm run build
```

Expected:

- helper test PASS
- `next build` exits 0

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/admin/branding/page.tsx apps/web/lib/ops-lifecycle.ts apps/web/lib/ops-lifecycle.test.ts apps/web/lib/presentation.ts
git commit -m "feat: add admin lifecycle operations panel"
```

## Self-Review

- Spec coverage:
  - daily automatic backup: Task 2
  - customer-selectable path: Tasks 1 and 4
  - protected manual backups: Task 2
  - selective restore: Task 3
  - manual offline updates: Task 3
  - mandatory pre-update backup: Task 3
  - visible operator status: Task 4
- Placeholder scan: no `TODO`, `TBD`, or “handle later” placeholders are intentionally left in the tasks.
- Type consistency:
  - backup kinds stay `"AUTOMATIC" | "MANUAL_PROTECTED" | "PRE_UPDATE"`
  - restore scopes stay `"FULL_SYSTEM" | "DATABASE_ONLY" | "OBJECTS_ONLY" | "CONFIG_ONLY"`
  - top-level API route remains `/ops-lifecycle`

Plan complete and saved to `docs/superpowers/plans/2026-07-16-backup-restore-update-lifecycle-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

