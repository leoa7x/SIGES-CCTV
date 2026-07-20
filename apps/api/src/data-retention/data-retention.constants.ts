export const DEFAULT_DATA_RETENTION_DAYS = 90;
export const DEFAULT_DATA_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function dataRetentionDays() {
  const raw = Number(process.env.DATA_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DATA_RETENTION_DAYS;
}

export function dataRetentionIntervalMs() {
  const raw = Number(process.env.DATA_RETENTION_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DATA_RETENTION_INTERVAL_MS;
}
