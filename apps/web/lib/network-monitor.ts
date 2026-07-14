import type { GrafanaEmbedDescriptor } from "./api";

export type GrafanaEmbedModel = {
  title: string;
  src: string | null;
};

export function buildGrafanaEmbedModel(descriptor: GrafanaEmbedDescriptor): GrafanaEmbedModel {
  try {
    const url = new URL(descriptor.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { title: descriptor.title, src: null };
    }

    for (const [key, value] of Object.entries(descriptor.params)) {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }

    return { title: descriptor.title, src: url.toString() };
  } catch {
    return { title: descriptor.title, src: null };
  }
}

export type MonitorNodeListItem = {
  id: string;
  code: string;
  name: string;
  primaryIp?: string | null;
  scanSubnetCidr?: string | null;
  operativeState: string;
  route: { identifier: string; center: { name: string } };
  _count: { assets: number; discoveryJobs: number; analyticsAssignments: number };
};

export type MonitorAnalyticsAssignment = {
  id: string;
  customLabel?: string | null;
  analyticsCatalog: { id: string; code: string; name: string };
};

export type MonitorAsset = {
  id: string;
  assetType: string;
  name: string;
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  operativeState: string;
  lastSeenAt?: string | null;
  analyticsAssignments: MonitorAnalyticsAssignment[];
};

export type MonitorDiscoveredDevice = {
  id: string;
  candidateType?: string | null;
  name?: string | null;
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  discoveryConfidence: number;
  status: string;
};

export type MonitorDiscoveryJob = {
  id: string;
  status: string;
  targetSubnetCidr?: string | null;
  createdAt: string;
  discoveredDevices: MonitorDiscoveredDevice[];
};

export type MonitorNodeDetail = {
  id: string;
  code: string;
  name: string;
  primaryIp?: string | null;
  scanSubnetCidr?: string | null;
  operativeState: string;
  route: { identifier: string; center: { name: string } };
  assets: MonitorAsset[];
  discoveryJobs: MonitorDiscoveryJob[];
  analyticsAssignments: MonitorAnalyticsAssignment[];
};

export type MonitorAlert = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export type TelemetryAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export function telemetryAlertLevel(severity: TelemetryAlertSeverity): MonitorAlert["level"] {
  if (severity === "CRITICAL") return "critical";
  if (severity === "WARNING") return "warning";
  return "info";
}

export function isCurrentNetworkDetailRequest(
  requestedNodeId: string,
  currentNodeId: string,
  requestId: number,
  currentRequestId: number,
) {
  return requestedNodeId === currentNodeId && requestId === currentRequestId;
}

export function formatTelemetryBytes(value: string | number) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const scaled = bytes / 1024 ** unitIndex;
  const formatted = scaled >= 10 || Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

export type MonitorInventoryRow = {
  id: string;
  source: "OFFICIAL" | "DISCOVERY";
  name: string;
  type: string;
  ip: string;
  mac: string;
  vendor: string;
  state: string;
  confidenceLabel: string;
};

export type MonitorObservability = {
  officialDevicesWithIp: number;
  officialDevicesWithMac: number;
  analyticsConfigured: number;
  latestDiscoveryLabel: string;
  topVendors: Array<{ vendor: string; count: number }>;
  pendingDiscoveries: number;
};

export type NetworkMonitorModel = {
  summary: {
    totalNodes: number;
    onlineNodes: number;
    degradedNodes: number;
    offlineNodes: number;
    officialAssets: number;
    pendingDiscoveries: number;
  };
  inventory: MonitorInventoryRow[];
  alerts: MonitorAlert[];
  observability: MonitorObservability;
  charts: {
    discoveryTrend: Array<{ id: string; label: string; discovered: number; confirmed: number; dismissed: number }>;
    assetTypeBreakdown: Array<{ type: string; count: number }>;
    stateBreakdown: Array<{ state: string; count: number }>;
  };
};

export function buildNetworkMonitorModel(nodes: MonitorNodeListItem[], detail: MonitorNodeDetail | null): NetworkMonitorModel {
  const latestDiscovery = detail?.discoveryJobs[0] ?? null;
  const pendingDiscoveries = latestDiscovery?.discoveredDevices.filter((device) => device.status === "DISCOVERED") ?? [];
  const inventory = [
    ...(detail?.assets ?? []).map((asset) => ({
      id: asset.id,
      source: "OFFICIAL" as const,
      name: asset.name,
      type: asset.assetType,
      ip: asset.ip ?? "—",
      mac: asset.mac ?? "—",
      vendor: asset.vendor ?? "—",
      state: asset.operativeState,
      confidenceLabel: "Oficial",
    })),
    ...pendingDiscoveries.map((device) => ({
      id: device.id,
      source: "DISCOVERY" as const,
      name: device.name || device.hostname || device.ip || "Dispositivo descubierto",
      type: device.candidateType ?? "SIN_CLASIFICAR",
      ip: device.ip ?? "—",
      mac: device.mac ?? "—",
      vendor: device.vendor ?? "—",
      state: device.status,
      confidenceLabel: `${device.discoveryConfidence}%`,
    })),
  ];

  const alerts = buildAlerts(detail, pendingDiscoveries.length);

  return {
    summary: {
      totalNodes: nodes.length,
      onlineNodes: nodes.filter((node) => node.operativeState === "ONLINE").length,
      degradedNodes: nodes.filter((node) => node.operativeState === "DEGRADED").length,
      offlineNodes: nodes.filter((node) => node.operativeState === "OFFLINE").length,
      officialAssets: nodes.reduce((acc, node) => acc + node._count.assets, 0),
      pendingDiscoveries: nodes.reduce((acc, node) => acc + node._count.discoveryJobs, 0),
    },
    inventory,
    alerts,
    observability: {
      officialDevicesWithIp: detail?.assets.filter((asset) => Boolean(asset.ip)).length ?? 0,
      officialDevicesWithMac: detail?.assets.filter((asset) => Boolean(asset.mac)).length ?? 0,
      analyticsConfigured:
        (detail?.analyticsAssignments.length ?? 0) +
        (detail?.assets.reduce((acc, asset) => acc + asset.analyticsAssignments.length, 0) ?? 0),
      latestDiscoveryLabel: latestDiscovery ? formatDate(latestDiscovery.createdAt) : "Sin escaneos",
      topVendors: topVendors(detail?.assets ?? [], pendingDiscoveries),
      pendingDiscoveries: pendingDiscoveries.length,
    },
    charts: {
      discoveryTrend: buildDiscoveryTrend(detail?.discoveryJobs ?? []),
      assetTypeBreakdown: buildAssetTypeBreakdown(detail?.assets ?? []),
      stateBreakdown: buildStateBreakdown(detail),
    },
  };
}

function buildAlerts(detail: MonitorNodeDetail | null, pendingDiscoveries: number): MonitorAlert[] {
  if (!detail) return [];

  const alerts: MonitorAlert[] = [];

  if (!detail.primaryIp) {
    alerts.push({
      id: "missing-primary-ip",
      level: "critical",
      title: "Nodo sin IP principal",
      detail: "No se puede correlacionar monitoreo ni discovery sin IP principal.",
    });
  }

  if (!detail.scanSubnetCidr) {
    alerts.push({
      id: "missing-subnet",
      level: "warning",
      title: "Nodo sin subred de escaneo",
      detail: "Configura el CIDR para discovery consistente por nodo.",
    });
  }

  if (pendingDiscoveries > 0) {
    alerts.push({
      id: "pending-discovery",
      level: "info",
      title: `${pendingDiscoveries} dispositivos pendientes de confirmar`,
      detail: "Hay hallazgos de discovery que aún no se incorporan al inventario oficial.",
    });
  }

  const affectedAssets = detail.assets.filter((asset) => asset.operativeState === "OFFLINE" || asset.operativeState === "DEGRADED");
  if (affectedAssets.length > 0) {
    alerts.push({
      id: "asset-health",
      level: affectedAssets.some((asset) => asset.operativeState === "OFFLINE") ? "critical" : "warning",
      title: `${affectedAssets.length} equipos con estado operativo afectado`,
      detail: affectedAssets.map((asset) => `${asset.name} (${asset.operativeState})`).join(", "),
    });
  }

  if ((detail.analyticsAssignments.length === 0) && detail.assets.every((asset) => asset.analyticsAssignments.length === 0)) {
    alerts.push({
      id: "missing-analytics",
      level: "warning",
      title: "Sin analíticas configuradas",
      detail: "El nodo y sus equipos todavía no tienen analíticas asociadas.",
    });
  }

  return alerts;
}

function topVendors(assets: MonitorAsset[], devices: MonitorDiscoveredDevice[]) {
  const counts = new Map<string, number>();
  for (const value of [...assets.map((asset) => asset.vendor), ...devices.map((device) => device.vendor)]) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([vendor, count]) => ({ vendor, count }));
}

function buildDiscoveryTrend(jobs: MonitorDiscoveryJob[]) {
  return [...jobs]
    .slice(0, 6)
    .reverse()
    .map((job) => ({
      id: job.id,
      label: new Intl.DateTimeFormat("es-CO", { month: "short", day: "numeric" }).format(new Date(job.createdAt)),
      discovered: job.discoveredDevices.filter((device) => device.status === "DISCOVERED").length,
      confirmed: job.discoveredDevices.filter((device) => device.status === "CONFIRMED" || device.status === "MERGED").length,
      dismissed: job.discoveredDevices.filter((device) => device.status === "DISMISSED").length,
    }));
}

function buildAssetTypeBreakdown(assets: MonitorAsset[]) {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    counts.set(asset.assetType, (counts.get(asset.assetType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ type, count }));
}

function buildStateBreakdown(detail: MonitorNodeDetail | null) {
  const counts = new Map<string, number>();
  if (detail) {
    counts.set(detail.operativeState, (counts.get(detail.operativeState) ?? 0) + 1);
    for (const asset of detail.assets) {
      counts.set(asset.operativeState, (counts.get(asset.operativeState) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([state, count]) => ({ state, count }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
