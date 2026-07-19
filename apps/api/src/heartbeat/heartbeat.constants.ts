export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEFAULT_HEARTBEAT_FAILURE_THRESHOLD = 2;
export const DEFAULT_HEARTBEAT_RECOVERY_THRESHOLD = 1;

export function heartbeatIntervalMs() {
  const raw = Number(process.env.HEARTBEAT_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEARTBEAT_INTERVAL_MS;
}

export function heartbeatFailureThreshold() {
  const raw = Number(process.env.HEARTBEAT_FAILURE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEARTBEAT_FAILURE_THRESHOLD;
}

export function heartbeatRecoveryThreshold() {
  const raw = Number(process.env.HEARTBEAT_RECOVERY_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEARTBEAT_RECOVERY_THRESHOLD;
}
