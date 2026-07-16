import type { CenterDiscoveryJob } from "./api";

type DiscoveredDevice = CenterDiscoveryJob["discoveredDevices"][number];

function buildDiscoveryKey(device: DiscoveredDevice) {
  const mac = device.mac?.trim().toLowerCase();
  if (mac) return `mac:${mac}`;

  const ip = device.ip?.trim().toLowerCase();
  if (ip) return `ip:${ip}`;

  return `device:${device.id}`;
}

export function getPendingCenterDiscoveries(discoveryJobs: Pick<CenterDiscoveryJob, "discoveredDevices">[]): DiscoveredDevice[] {
  const uniqueDevices = new Map<string, DiscoveredDevice>();

  for (const job of discoveryJobs) {
    for (const device of job.discoveredDevices) {
      if (device.status !== "DISCOVERED") continue;

      const key = buildDiscoveryKey(device);
      if (!uniqueDevices.has(key)) {
        uniqueDevices.set(key, device);
      }
    }
  }

  return Array.from(uniqueDevices.values());
}
