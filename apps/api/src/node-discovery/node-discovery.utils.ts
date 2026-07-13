import { NodeAssetType } from "@prisma/client";

type RawDiscoveredDevice = Record<string, unknown>;

export type NormalizedDiscoveredDevice = {
  candidateType: NodeAssetType | null;
  name: string | null;
  ip: string | null;
  mac: string | null;
  vendor: string | null;
  model: string | null;
  hostname: string | null;
  discoveryConfidence: number;
  rawPayload: RawDiscoveredDevice;
};

const TYPE_ALIASES: Array<{ match: RegExp; value: NodeAssetType }> = [
  { match: /camera[\s_-]*ptz|ptz/i, value: NodeAssetType.CAMARA_PTZ },
  { match: /camera[\s_-]*fija|fixed[\s_-]*camera|bullet|dome/i, value: NodeAssetType.CAMARA_FIJA },
  { match: /switch/i, value: NodeAssetType.SWITCH },
  { match: /ups/i, value: NodeAssetType.UPS },
];

export function deriveSubnetFromIp(ip: string) {
  const octets = ip.trim().split(".");
  if (octets.length !== 4 || octets.some((part) => part === "" || Number.isNaN(Number(part)))) {
    throw new Error(`No se pudo derivar subred desde IP inválida: ${ip}`);
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function normalizeDiscoveredDevices(rawDevices: RawDiscoveredDevice[]): NormalizedDiscoveredDevice[] {
  return rawDevices.map((device) => {
    const hostname = readString(device, ["hostname", "hostName", "dns", "name"]);
    const candidateType = detectCandidateType(readString(device, ["type", "deviceType", "category", "kind"]));
    return {
      candidateType,
      name: hostname ?? readString(device, ["name", "label", "title"]),
      ip: readString(device, ["ip", "ipAddress", "address"]),
      mac: readString(device, ["mac", "macAddress"]),
      vendor: readString(device, ["vendor", "manufacturer", "brand"]),
      model: readString(device, ["model", "deviceModel"]),
      hostname,
      discoveryConfidence: readNumber(device, ["confidence", "score"], 50),
      rawPayload: device,
    };
  });
}

function detectCandidateType(typeLabel: string | null) {
  if (!typeLabel) return null;
  for (const alias of TYPE_ALIASES) {
    if (alias.match.test(typeLabel)) return alias.value;
  }
  return null;
}

function readString(source: RawDiscoveredDevice, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(source: RawDiscoveredDevice, keys: string[], fallback: number) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return fallback;
}
