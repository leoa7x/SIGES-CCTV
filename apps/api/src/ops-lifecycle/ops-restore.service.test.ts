import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { OpsRestoreService } from "./ops-restore.service";

test("restoreBackup records a successful restore when the manifest is valid", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "siges-restore-"));
  const backupPath = path.join(root, "2026-07-16_23-00-00");
  await fs.mkdir(path.join(backupPath, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(backupPath, "metadata", "restore-manifest.json"),
    JSON.stringify({ status: "SUCCEEDED" }),
  );

  const prisma = {
    opsRestoreRecord: {
      create: async ({ data }: any) => ({ id: "restore-1", ...data }),
      update: async ({ data }: any) => data,
    },
  };

  const service = new OpsRestoreService(prisma as never);
  const result = await service.restoreBackup("DATABASE_ONLY", backupPath);

  assert.equal(result.id, "restore-1");
  assert.equal(result.status, "SUCCEEDED");
});

test("restoreBackup rejects incomplete backups", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "siges-restore-invalid-"));
  const backupPath = path.join(root, "2026-07-16_23-00-00");
  await fs.mkdir(path.join(backupPath, "metadata"), { recursive: true });
  await fs.writeFile(
    path.join(backupPath, "metadata", "restore-manifest.json"),
    JSON.stringify({ status: "FAILED" }),
  );

  const service = new OpsRestoreService({ opsRestoreRecord: {} } as never);

  await assert.rejects(
    () => service.restoreBackup("FULL_SYSTEM", backupPath),
    /no está completo/i,
  );
});
