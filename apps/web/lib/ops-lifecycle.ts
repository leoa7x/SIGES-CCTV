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
    lastBackupLabel: summary.lastBackup
      ? `${formatOpsOperationStatus(summary.lastBackup.status)} · ${formatRelativeTime(summary.lastBackup.createdAt)}`
      : "Sin respaldo registrado",
    lastUpdateLabel: summary.lastUpdate
      ? `${summary.lastUpdate.versionLabel} · ${formatOpsOperationStatus(summary.lastUpdate.status)}`
      : "Sin actualización registrada",
  };
}
