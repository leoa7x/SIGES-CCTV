import assert from "node:assert/strict";
import test from "node:test";

import { OpsUpdateService } from "./ops-update.service";

test("applyOfflineUpdate creates a pre-update backup before recording the update", async () => {
  let createdPayload: any = null;
  const backupService = {
    runBackup: async () => ({
      id: "backup-pre-1",
      backupPath: "/tmp/backup",
      manifestPath: "/tmp/backup/metadata/restore-manifest.json",
      status: "SUCCEEDED",
    }),
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
  const result = await service.applyOfflineUpdate({
    versionLabel: "2026.07.16",
    packagePath: "D:\\updates\\SIGES-Update-2026.07.16.exe",
  });

  assert.equal(createdPayload.preUpdateBackupId, "backup-pre-1");
  assert.equal(result.preUpdateBackupId, "backup-pre-1");
  assert.equal(result.status, "SUCCEEDED");
});
