import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OpsBackupService } from "./ops-backup.service";

test("runBackup writes manifest folders and skips retention for protected backups", async () => {
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

test("runBackup removes automatic backups beyond retention", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "siges-backup-retention-"));
  const stalePath = path.join(root, "stale-backup");
  await fs.mkdir(stalePath, { recursive: true });

  const deletedIds: string[][] = [];
  const prisma = {
    opsLifecycleSettings: { findFirst: async () => ({ backupRootPath: root, automaticRetentionCount: 1 }) },
    opsBackupRecord: {
      create: async ({ data }: any) => ({ id: "backup-new", ...data }),
      update: async ({ data }: any) => data,
      findMany: async () => ([
        { id: "backup-new", backupPath: path.join(root, "new-backup"), createdAt: new Date("2026-07-16T10:00:00.000Z") },
        { id: "backup-stale", backupPath: stalePath, createdAt: new Date("2026-07-15T10:00:00.000Z") },
      ]),
      deleteMany: async ({ where }: any) => {
        deletedIds.push(where.id.in);
        return { count: where.id.in.length };
      },
    },
  };

  const service = new OpsBackupService(prisma as never);
  await service.runBackup("AUTOMATIC");

  await assert.rejects(() => fs.stat(stalePath), { code: "ENOENT" });
  assert.deepEqual(deletedIds, [["backup-stale"]]);
});
