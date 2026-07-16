import assert from "node:assert/strict";
import test from "node:test";

import { formatOpsOperationStatus, normalizeOpsLifecycleSummary } from "./ops-lifecycle";

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
  assert.equal(summary.lastUpdateLabel, "Sin actualización registrada");
  assert.equal(formatOpsOperationStatus("SUCCEEDED"), "Completado");
});
