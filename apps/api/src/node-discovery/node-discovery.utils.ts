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

const TYPE_HEURISTICS: Array<{
  value: NodeAssetType;
  model?: RegExp;
  vendor?: RegExp;
  hostname?: RegExp;
}> = [
  {
    value: NodeAssetType.CAMARA_PTZ,
    model: /ptz|speed[\s_-]*dome|sd\d|ds-2de/i,
    vendor: /hikvision|dahua|axis|hanwha|uniview|vivotek|bosch|avigilon/i,
    hostname: /ptz|speed[\s_-]*dome/i,
  },
  {
    value: NodeAssetType.CAMARA_FIJA,
    model: /bullet|dome|turret|ipc|camera|cam/i,
    vendor: /hikvision|dahua|axis|hanwha|uniview|vivotek|bosch|avigilon/i,
    hostname: /camera|cam|bullet|dome|turret/i,
  },
  {
    value: NodeAssetType.SWITCH,
    model: /switch|css|crs|cbs|sg\d|tl-sg/i,
    vendor: /mikrotik|cisco|ubiquiti|tp-link|netgear|aruba|juniper/i,
    hostname: /switch|sw[-_]?/i,
  },
  {
    value: NodeAssetType.UPS,
    model: /ups|smart[-\s]?ups|back[-\s]?ups/i,
    vendor: /apc|tripp\s?lite|vertiv|forza|cdp|eaton/i,
    hostname: /ups|no[-_ ]?break/i,
  },
];

const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_REGEX = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);
const CIDR_REGEX = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}\\/(3[0-2]|[12]?\\d)$`);

export function isValidIp(value: string) {
  return IPV4_REGEX.test(value.trim());
}

export function isValidCidr(value: string) {
  return CIDR_REGEX.test(value.trim());
}

export function deriveSubnetFromIp(ip: string) {
  const octets = ip.trim().split(".");
  if (octets.length !== 4 || octets.some((part) => part === "" || Number.isNaN(Number(part)))) {
    throw new Error(`No se pudo derivar subred desde IP inválida: ${ip}`);
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

export function isIpWithinCidr(ip: string, cidr: string) {
  if (!isValidIp(ip) || !isValidCidr(cidr)) return false;
  const [networkIp, prefixText] = cidr.trim().split("/");
  const prefix = Number(prefixText);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipToNumber(ip) & mask) === (ipToNumber(networkIp) & mask);
}

export function normalizeDiscoveredDevices(rawDevices: RawDiscoveredDevice[]): NormalizedDiscoveredDevice[] {
  return rawDevices.map((device) => {
    const hostname = readString(device, ["hostname", "hostName", "dns", "name"]);
    const explicitType = detectCandidateType(readString(device, ["type", "deviceType", "category", "kind"]));
    const vendor = readString(device, ["vendor", "manufacturer", "brand"]);
    const model = readString(device, ["model", "deviceModel"]);
    const inferredType = explicitType
      ? { candidateType: explicitType, discoveryConfidence: readNumber(device, ["confidence", "score"], 50) }
      : inferCandidateType({ vendor, model, hostname });
    return {
      candidateType: inferredType.candidateType,
      name: hostname ?? readString(device, ["name", "label", "title"]),
      ip: readString(device, ["ip", "ipAddress", "address"]),
      mac: readString(device, ["mac", "macAddress"]),
      vendor,
      model,
      hostname,
      discoveryConfidence: readNumber(device, ["confidence", "score"], inferredType.discoveryConfidence),
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

function inferCandidateType(input: {
  vendor: string | null;
  model: string | null;
  hostname: string | null;
}) {
  for (const heuristic of TYPE_HEURISTICS) {
    if (heuristic.model && input.model && heuristic.model.test(input.model)) {
      return { candidateType: heuristic.value, discoveryConfidence: 85 };
    }
  }

  for (const heuristic of TYPE_HEURISTICS) {
    if (heuristic.vendor && input.vendor && heuristic.vendor.test(input.vendor)) {
      const hostnameConfirms = Boolean(heuristic.hostname && input.hostname && heuristic.hostname.test(input.hostname));
      return {
        candidateType: heuristic.value,
        discoveryConfidence: hostnameConfirms ? 80 : 75,
      };
    }
  }

  for (const heuristic of TYPE_HEURISTICS) {
    if (heuristic.hostname && input.hostname && heuristic.hostname.test(input.hostname)) {
      return { candidateType: heuristic.value, discoveryConfidence: 60 };
    }
  }

  return { candidateType: null, discoveryConfidence: 50 };
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

function ipToNumber(ip: string) {
  return ip.trim().split(".").reduce((value, octet) => (value << 8) + Number(octet), 0) >>> 0;
}
