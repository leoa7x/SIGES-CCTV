import type { GrafanaEmbedDescriptor } from "./api";
import type { StateChangeEvent } from "../hooks/use-monitor";

export type GrafanaEmbedModel = {
  title: string;
  src: string | null;
};

type ObservabilityEmbedPathInput =
  | { dashboard: "network-command-view"; centerId?: string | null }
  | { dashboard: "node-observability"; nodeId: string };

export function buildObservabilityEmbedPath(input: ObservabilityEmbedPathInput) {
  if (input.dashboard === "node-observability") {
    return `/observability/embed/node/${encodeURIComponent(input.nodeId)}`;
  }

  const params = new URLSearchParams();
  if (input.centerId) params.set("centerId", input.centerId);
  const query = params.toString();
  return query
    ? `/observability/embed/network-command-view?${query}`
    : "/observability/embed/network-command-view";
}

export function buildGrafanaEmbedModel(descriptor: GrafanaEmbedDescriptor): GrafanaEmbedModel {
  try {
    const browserOrigin = typeof window === "undefined" ? undefined : window.location.origin;
    const url = new URL(descriptor.url, browserOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { title: descriptor.title, src: null };
    }

    // Grafana is published by Caddy under /grafana. Keep an embed on the
    // current browser origin: localhost on the server and the LAN address on
    // operator workstations. This avoids a fixed-IP iframe from failing in
    // WSL's local network path.
    if (browserOrigin && (url.pathname === "/grafana" || url.pathname.startsWith("/grafana/"))) {
      const currentOrigin = new URL(browserOrigin);
      url.protocol = currentOrigin.protocol;
      url.host = currentOrigin.host;
    }

    for (const [key, value] of Object.entries(descriptor.params)) {
      url.searchParams.set(key, value);
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

export type TopologyNodeItem = {
  id: string;
  code: string;
  name: string;
  operativeState: string;
  nodeType: string;
  ip: string | null;
  _count: { cameras: number };
  route: {
    id: string;
    name: string;
    center: {
      id: string;
      name: string;
      project: { id: string; name: string; city: { id: string; name: string } };
    };
  };
};

export type TopologyCenterAsset = {
  id: string;
  name: string;
  assetType: string;
  ip?: string | null;
  mac?: string | null;
  operativeState: string;
};

export type TopologyCenterListItem = {
  id: string;
  name: string;
  project: { id: string; name: string; city: { id: string; name: string } };
  _count: { routes: number; centerAssets: number };
};

export type TopologyCenterDetail = {
  id: string;
  name: string;
  project: { id: string; name: string; city: { id: string; name: string } };
  centerAssets: TopologyCenterAsset[];
};

export type TopologyCenterGroup = {
  centerId: string;
  centerName: string;
  projectName: string;
  cityName: string;
  nodes: TopologyNodeItem[];
  centerAssets: TopologyCenterAsset[];
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

export type MonitorCenterAsset = {
  id: string;
  assetType: string;
  name: string;
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  operativeState: string;
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
  route: { identifier: string; center: { id: string; name: string } };
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

export type DashboardSummary = {
  nodes: { total: number; online: number; offline: number; degraded: number };
  cameras: { total: number; online: number; offline: number };
  incidents: { open: number; critical: number };
  recentIncidents: {
    id: string;
    title: string;
    severity: string;
    status: string;
    detectedAt: string;
    node?: { code: string; name: string } | null;
    assignedUser?: { name: string | null; email: string } | null;
  }[];
};

export function buildNetworkMonitorModel(
  nodes: MonitorNodeListItem[],
  detail: MonitorNodeDetail | null,
  centerAssets: MonitorCenterAsset[] = [],
): NetworkMonitorModel {
  const latestDiscovery = detail?.discoveryJobs[0] ?? null;
  const pendingDiscoveries = latestDiscovery?.discoveredDevices.filter((device) => device.status === "DISCOVERED") ?? [];
  const inventory = [
    ...centerAssets.map((asset) => ({
      id: asset.id,
      source: "OFFICIAL" as const,
      name: asset.name,
      type: asset.assetType,
      ip: asset.ip ?? "—",
      mac: asset.mac ?? "—",
      vendor: asset.vendor ?? "—",
      state: asset.operativeState,
      confidenceLabel: "CMC",
    })),
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
      officialAssets: centerAssets.length + nodes.reduce((acc, node) => acc + node._count.assets, 0),
      pendingDiscoveries: nodes.reduce((acc, node) => acc + node._count.discoveryJobs, 0),
    },
    inventory,
    alerts,
    observability: {
      officialDevicesWithIp:
        centerAssets.filter((asset) => Boolean(asset.ip)).length +
        (detail?.assets.filter((asset) => Boolean(asset.ip)).length ?? 0),
      officialDevicesWithMac:
        centerAssets.filter((asset) => Boolean(asset.mac)).length +
        (detail?.assets.filter((asset) => Boolean(asset.mac)).length ?? 0),
      analyticsConfigured:
        (detail?.analyticsAssignments.length ?? 0) +
        (detail?.assets.reduce((acc, asset) => acc + asset.analyticsAssignments.length, 0) ?? 0),
      latestDiscoveryLabel: latestDiscovery ? formatDate(latestDiscovery.createdAt) : "Sin escaneos",
      topVendors: topVendors([...centerAssets, ...(detail?.assets ?? [])], pendingDiscoveries),
      pendingDiscoveries: pendingDiscoveries.length,
    },
    charts: {
      discoveryTrend: buildDiscoveryTrend(detail?.discoveryJobs ?? []),
      assetTypeBreakdown: buildAssetTypeBreakdown([...centerAssets, ...(detail?.assets ?? [])]),
      stateBreakdown: buildStateBreakdown(detail, centerAssets),
    },
  };
}

export function applyNodeStateChange(
  nodes: MonitorNodeListItem[],
  event: StateChangeEvent | null,
): MonitorNodeListItem[] {
  if (!event || event.entityType !== "node") return nodes;
  return nodes.map((node) =>
    node.id === event.entityId ? { ...node, operativeState: event.newState } : node,
  );
}

export function applyNodeDetailStateChange(
  detail: MonitorNodeDetail | null,
  event: StateChangeEvent | null,
): MonitorNodeDetail | null {
  if (!detail || !event || event.entityType !== "node") return detail;
  if (detail.id !== event.entityId) return detail;
  return { ...detail, operativeState: event.newState };
}

export function applyDashboardSummaryStateChange(
  summary: DashboardSummary | null,
  event: StateChangeEvent | null,
): DashboardSummary | null {
  if (!summary || !event || event.entityType !== "node") return summary;
  if (event.oldState === event.newState) return summary;

  const nextNodes = { ...summary.nodes };
  decrementStateCount(nextNodes, event.oldState);
  incrementStateCount(nextNodes, event.newState);

  return {
    ...summary,
    nodes: nextNodes,
  };
}

export function buildTopologyCenterGroups(
  nodes: TopologyNodeItem[],
  centers: TopologyCenterListItem[],
  centerDetailsById: Record<string, TopologyCenterDetail> = {},
): TopologyCenterGroup[] {
  const groups = new Map<string, TopologyCenterGroup>();

  for (const center of centers) {
    groups.set(center.id, {
      centerId: center.id,
      centerName: center.name,
      projectName: center.project.name,
      cityName: center.project.city.name,
      nodes: [],
      centerAssets: centerDetailsById[center.id]?.centerAssets ?? [],
    });
  }

  for (const node of nodes) {
    const { center } = node.route;
    if (!groups.has(center.id)) {
      groups.set(center.id, {
        centerId: center.id,
        centerName: center.name,
        projectName: center.project.name,
        cityName: center.project.city.name,
        nodes: [],
        centerAssets: centerDetailsById[center.id]?.centerAssets ?? [],
      });
    }
    groups.get(center.id)?.nodes.push(node);
  }

  for (const [centerId, detail] of Object.entries(centerDetailsById)) {
    const existing = groups.get(centerId);
    if (existing) {
      existing.centerAssets = [...detail.centerAssets].sort((a, b) => a.name.localeCompare(b.name));
      continue;
    }

    groups.set(centerId, {
      centerId,
      centerName: detail.name,
      projectName: detail.project.name,
      cityName: detail.project.city.name,
      nodes: [],
      centerAssets: [...detail.centerAssets].sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      nodes: [...group.nodes].sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.centerName.localeCompare(b.centerName));
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

function topVendors(assets: Array<MonitorAsset | MonitorCenterAsset>, devices: MonitorDiscoveredDevice[]) {
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

function buildAssetTypeBreakdown(assets: Array<MonitorAsset | MonitorCenterAsset>) {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    counts.set(asset.assetType, (counts.get(asset.assetType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ type, count }));
}

function buildStateBreakdown(detail: MonitorNodeDetail | null, centerAssets: MonitorCenterAsset[]) {
  const counts = new Map<string, number>();
  if (detail) {
    counts.set(detail.operativeState, (counts.get(detail.operativeState) ?? 0) + 1);
  }
  for (const asset of [...centerAssets, ...(detail?.assets ?? [])]) {
    counts.set(asset.operativeState, (counts.get(asset.operativeState) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([state, count]) => ({ state, count }));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function incrementStateCount(
  nodes: DashboardSummary["nodes"],
  state: string,
) {
  if (state === "ONLINE") nodes.online += 1;
  if (state === "OFFLINE") nodes.offline += 1;
  if (state === "DEGRADED") nodes.degraded += 1;
}

function decrementStateCount(
  nodes: DashboardSummary["nodes"],
  state: string,
) {
  if (state === "ONLINE" && nodes.online > 0) nodes.online -= 1;
  if (state === "OFFLINE" && nodes.offline > 0) nodes.offline -= 1;
  if (state === "DEGRADED" && nodes.degraded > 0) nodes.degraded -= 1;
}
