import {
  deriveSubnetFromIp,
  isValidCidr,
  isValidIp,
  normalizeDiscoveredDevices,
  type NormalizedDiscoveredDevice,
} from "../node-discovery/node-discovery.utils";

export { deriveSubnetFromIp, isValidCidr, isValidIp };

export function normalizeCenterDiscoveredDevices(rawDevices: Record<string, unknown>[]): NormalizedDiscoveredDevice[] {
  return normalizeDiscoveredDevices(rawDevices);
}
