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
