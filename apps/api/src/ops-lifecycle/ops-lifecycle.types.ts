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
