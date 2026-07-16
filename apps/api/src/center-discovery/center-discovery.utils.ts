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

/** Uppercases and strips separators so "aa:bb:cc..." and "AA-BB-CC..." compare equal. */
export function normalizeMacAddress(mac: string | null | undefined): string {
  if (!mac) return "";
  return mac.toUpperCase().replace(/[^0-9A-F]/g, "");
}
