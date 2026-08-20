import { NodeState } from "@prisma/client";

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
export const DEFAULT_HEARTBEAT_FAILURE_THRESHOLD = 2;
export const DEFAULT_HEARTBEAT_RECOVERY_THRESHOLD = 1;
export const DEFAULT_HEARTBEAT_CONCURRENCY = 20;

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

export function heartbeatConcurrency() {
  const raw = Number(process.env.HEARTBEAT_CONCURRENCY);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEARTBEAT_CONCURRENCY;
}

function parsePorts(raw: string | undefined, fallback: number[]) {
  const ports = (raw ?? "").split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0 && value <= 65535);
  return ports.length ? [...new Set(ports)] : fallback;
}

// A device can intentionally block ICMP while its management service is alive.
export function heartbeatTcpFallbackPorts() {
  return parsePorts(process.env.HEARTBEAT_TCP_FALLBACK_PORTS, [80, 443, 8291, 8728]);
}

export function cameraHeartbeatIntervalMs() {
  const raw = Number(process.env.CAMERA_HEARTBEAT_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

// RTSP, web/ONVIF and Dahua's management port cover the imported fleet.
export function cameraHeartbeatPorts() {
  return parsePorts(process.env.CAMERA_HEARTBEAT_PORTS, [554, 80, 37777]);
}

// The only two states automation (heartbeat, discovery reconciliation) is
// allowed to write. MAINTENANCE/DEGRADED reflect a human judgment call (a
// technician flagged the device or is actively working on it) and must
// never be silently overwritten by a reachability probe or a scan.
export const AUTO_MANAGED_STATES: NodeState[] = [NodeState.ONLINE, NodeState.OFFLINE];
