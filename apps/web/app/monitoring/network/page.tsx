"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { GrafanaPanelEmbed } from "../../../components/grafana-panel-embed";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPost, type GrafanaEmbedDescriptor } from "../../../lib/api";
import {
  buildGrafanaEmbedModel,
  buildNetworkMonitorModel,
  formatTelemetryBytes,
  isCurrentNetworkDetailRequest,
  telemetryAlertLevel,
  type MonitorDiscoveryJob,
  type MonitorNodeDetail,
  type MonitorNodeListItem,
} from "../../../lib/network-monitor";
import { tabClass } from "../../../lib/ui";

const PANEL = "rounded-ops border border-ops-border bg-ops-panel p-4";
const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const PANEL_HUD = "rounded-ops border border-ops-border bg-[radial-gradient(circle_at_top,rgba(29,78,216,0.16),transparent_42%),linear-gradient(180deg,rgba(11,19,33,0.98),rgba(9,15,27,0.98))] p-4 shadow-ops";
const PANEL_GRID = "rounded-ops border border-ops-border bg-[linear-gradient(180deg,rgba(9,15,27,0.98),rgba(6,10,19,0.98)),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:auto,24px_24px,24px_24px] p-4 shadow-ops";

const ALERT_STYLES = {
  critical: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  warning: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  info: "border-ops-blue/30 bg-ops-blue/10 text-ops-blue",
} as const;

type DiscoveryDevice = MonitorDiscoveryJob["discoveredDevices"][number];

type NetworkTelemetrySummary = {
  snapshotId: string | null;
  capturedAt: string | null;
  totalBytesIn: string;
  totalBytesOut: string;
  activeHosts: number;
  activeFlows: number;
  alertCount: number;
  topProtocols: Array<{ name: string; bytes: number; flowCount: number }>;
  topDestinations: Array<{ target: string; kind: string; bytes: number; flowCount: number }>;
};

type NetworkTelemetryPoint = {
  capturedAt: string;
  totalBytesIn: string;
  totalBytesOut: string;
  activeHosts: number;
  activeFlows: number;
};

type NetworkTelemetryAssetView = {
  id: string;
  nodeAssetId?: string | null;
  ip?: string | null;
  mac?: string | null;
  hostname?: string | null;
  bytesIn: string;
  bytesOut: string;
  flowCount: number;
  lastSeenAt: string;
  classificationSource: "OFFICIAL" | "DISCOVERY" | "UNMATCHED";
  nodeAsset?: { id: string; name: string; assetType: string } | null;
};

type NetworkTelemetryAlert = {
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  detail: string;
  lastSeenAt: string;
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{sub}</p>
    </div>
  );
}

function MiniBarChart({
  items,
  colorClass,
}: {
  items: Array<{ label: string; value: number }>;
  colorClass: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-ops-muted">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(8, Math.round((item.value / max) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscoveryTrendChart({
  items,
}: {
  items: Array<{ id: string; label: string; discovered: number; confirmed: number; dismissed: number }>;
}) {
  const max = Math.max(
    1,
    ...items.map((item) => item.discovered + item.confirmed + item.dismissed),
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(56px,1fr))] gap-3">
        {items.map((item) => {
          const total = item.discovered + item.confirmed + item.dismissed;
          const discoveredHeight = (item.discovered / max) * 100;
          const confirmedHeight = (item.confirmed / max) * 100;
          const dismissedHeight = (item.dismissed / max) * 100;
          return (
            <div key={item.id} className="rounded-ops border border-ops-border bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(2,6,23,0.98))] p-2">
              <div className="flex h-28 items-end justify-center gap-1">
                <div className="w-3 rounded-t bg-ops-blue" style={{ height: `${discoveredHeight}%` }} title={`Pendientes ${item.discovered}`} />
                <div className="w-3 rounded-t bg-ops-emerald" style={{ height: `${confirmedHeight}%` }} title={`Confirmados ${item.confirmed}`} />
                <div className="w-3 rounded-t bg-ops-amber" style={{ height: `${dismissedHeight}%` }} title={`Descartados ${item.dismissed}`} />
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-semibold text-ops-text">{total}</p>
                <p className="text-[10px] text-ops-muted">{item.label}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-ops-muted">
        <span><span className="inline-block h-2 w-2 rounded-full bg-ops-blue" /> Pendientes</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-ops-emerald" /> Confirmados</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-ops-amber" /> Descartados</span>
      </div>
    </div>
  );
}

function TelemetryStrip({
  title,
  value,
  accentClass,
  barClass,
  segments,
}: {
  title: string;
  value: string | number;
  accentClass: string;
  barClass: string;
  segments: number[];
}) {
  const safeSegments = segments.length > 0 ? segments : [0];
  const max = Math.max(1, ...safeSegments);
  return (
    <div className="rounded-ops border border-ops-border bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,6,23,0.96))] p-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ops-muted">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</p>
      <div className="mt-3 flex h-12 items-end gap-1">
        {safeSegments.map((segment, index) => (
          <div
            key={`${title}-${index}`}
            className={`min-w-0 flex-1 rounded-t ${barClass}`}
            style={{ height: `${Math.max(8, Math.round((segment / max) * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SignalMatrix({
  items,
}: {
  items: Array<{ label: string; value: string; tone: string }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-ops border border-ops-border bg-black/20 p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-ops-muted">{item.label}</p>
          <p className={`mt-2 text-lg font-semibold ${item.tone}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function stateBadge(state: string) {
  if (state === "ONLINE") return "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald";
  if (state === "DEGRADED") return "border-ops-amber/30 bg-ops-amber/10 text-ops-amber";
  if (state === "OFFLINE") return "border-ops-rose/30 bg-ops-rose/10 text-ops-rose";
  return "border-ops-border bg-ops-surface text-ops-muted";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  OFFICIAL: "Oficial",
  DISCOVERY: "Discovery",
  UNMATCHED: "Sin correlación",
};

function classificationLabel(source: string) {
  return CLASSIFICATION_LABELS[source] ?? source;
}

export default function NetworkMonitoringPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<MonitorNodeListItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [detail, setDetail] = useState<MonitorNodeDetail | null>(null);
  const [telemetrySummary, setTelemetrySummary] = useState<NetworkTelemetrySummary | null>(null);
  const [telemetryTimeseries, setTelemetryTimeseries] = useState<NetworkTelemetryPoint[]>([]);
  const [telemetryAssets, setTelemetryAssets] = useState<NetworkTelemetryAssetView[]>([]);
  const [telemetryAlerts, setTelemetryAlerts] = useState<NetworkTelemetryAlert[]>([]);
  const [networkEmbedDescriptor, setNetworkEmbedDescriptor] = useState<GrafanaEmbedDescriptor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingNetworkEmbed, setLoadingNetworkEmbed] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [resolvingDiscoveryId, setResolvingDiscoveryId] = useState("");
  const [filter, setFilter] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("");
  const [tab, setTab] = useState<"inventario" | "trafico" | "alertas">("inventario");
  const selectedNodeIdRef = useRef(selectedNodeId);
  const detailRequestIdRef = useRef(0);

  selectedNodeIdRef.current = selectedNodeId;

  const filteredNodes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((node) =>
      node.code.toLowerCase().includes(q) ||
      node.name.toLowerCase().includes(q) ||
      node.route.identifier.toLowerCase().includes(q) ||
      node.route.center.name.toLowerCase().includes(q));
  }, [filter, nodes]);

  const latestJob = detail?.discoveryJobs[0] ?? null;
  const model = useMemo(() => buildNetworkMonitorModel(nodes, detail), [nodes, detail]);
  const networkEmbed = useMemo(
    () => networkEmbedDescriptor ? buildGrafanaEmbedModel(networkEmbedDescriptor) : null,
    [networkEmbedDescriptor],
  );
  const filteredInventory = useMemo(() => {
    const q = inventoryFilter.trim().toLowerCase();
    if (!q) return model.inventory;
    return model.inventory.filter((row) =>
      row.name.toLowerCase().includes(q) ||
      row.type.toLowerCase().includes(q) ||
      row.ip.toLowerCase().includes(q) ||
      row.mac.toLowerCase().includes(q) ||
      row.vendor.toLowerCase().includes(q));
  }, [model.inventory, inventoryFilter]);

  const loadNodes = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await apiGet<MonitorNodeListItem[]>("/nodes", accessToken);
      setNodes(response);
      if (!selectedNodeId && response[0]?.id) {
        setSelectedNodeId(response[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedNodeId]);

  const resetNodeData = useCallback(() => {
    setDetail(null);
    setTelemetrySummary(null);
    setTelemetryTimeseries([]);
    setTelemetryAssets([]);
    setTelemetryAlerts([]);
  }, []);

  const loadDetail = useCallback(async (nodeId: string) => {
    if (!accessToken || !nodeId || selectedNodeIdRef.current !== nodeId) return;
    const requestId = ++detailRequestIdRef.current;
    const isCurrentRequest = () => isCurrentNetworkDetailRequest(
      nodeId,
      selectedNodeIdRef.current,
      requestId,
      detailRequestIdRef.current,
    );

    setLoadingDetail(true);
    resetNodeData();
    try {
      const [detailResponse, summaryResponse, timeseriesResponse, assetsResponse, alertsResponse] = await Promise.all([
        apiGet<MonitorNodeDetail>(`/nodes/${nodeId}`, accessToken),
        apiGet<NetworkTelemetrySummary>(`/network-telemetry/nodes/${nodeId}/summary`, accessToken),
        apiGet<NetworkTelemetryPoint[]>(`/network-telemetry/nodes/${nodeId}/timeseries`, accessToken),
        apiGet<NetworkTelemetryAssetView[]>(`/network-telemetry/nodes/${nodeId}/assets`, accessToken),
        apiGet<NetworkTelemetryAlert[]>(`/network-telemetry/nodes/${nodeId}/alerts`, accessToken),
      ]);
      if (!isCurrentRequest()) return;

      setDetail(detailResponse);
      setTelemetrySummary(summaryResponse);
      setTelemetryTimeseries(timeseriesResponse);
      setTelemetryAssets(assetsResponse);
      setTelemetryAlerts(alertsResponse);
    } catch {
      if (isCurrentRequest()) resetNodeData();
    } finally {
      if (isCurrentRequest()) setLoadingDetail(false);
    }
  }, [accessToken, resetNodeData]);

  useEffect(() => { void loadNodes(); }, [loadNodes]);
  useEffect(() => { if (selectedNodeId) void loadDetail(selectedNodeId); }, [selectedNodeId, loadDetail]);
  useEffect(() => {
    if (!accessToken) {
      setNetworkEmbedDescriptor(null);
      setLoadingNetworkEmbed(false);
      return;
    }

    let cancelled = false;
    setNetworkEmbedDescriptor(null);
    setLoadingNetworkEmbed(true);

    void apiGet<GrafanaEmbedDescriptor>("/observability/embed/network-command-view", accessToken)
      .then((descriptor) => {
        if (!cancelled) setNetworkEmbedDescriptor(descriptor);
      })
      .catch(() => {
        if (!cancelled) setNetworkEmbedDescriptor(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingNetworkEmbed(false);
      });

    return () => { cancelled = true; };
  }, [accessToken]);

  async function handleRunDiscovery() {
    if (!accessToken || !detail) return;
    setRunningDiscovery(true);
    try {
      await apiPost(`/nodes/${detail.id}/discovery-jobs`, accessToken, {});
      await loadNodes();
      await loadDetail(detail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo ejecutar el discovery.");
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleConfirm(device: DiscoveryDevice) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(device.id);
    try {
      await apiPost(`/node-discovery/devices/${device.id}/confirm`, accessToken, {
        assetType: device.candidateType || "SWITCH",
        name: device.name || device.hostname || device.ip || "Equipo descubierto",
      });
      await loadNodes();
      await loadDetail(detail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo confirmar el dispositivo.");
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  async function handleDismiss(device: DiscoveryDevice) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(device.id);
    try {
      await apiPost(`/node-discovery/devices/${device.id}/dismiss`, accessToken, {});
      await loadDetail(detail.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No se pudo descartar el dispositivo.");
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  const observabilityAssets = telemetryAssets;
  const telemetryPulseCards = telemetrySummary ? [
    { label: "Bytes In", value: formatTelemetryBytes(telemetrySummary.totalBytesIn), sub: "ventana más reciente" },
    { label: "Bytes Out", value: formatTelemetryBytes(telemetrySummary.totalBytesOut), sub: "ventana más reciente" },
    { label: "Hosts activos", value: telemetrySummary.activeHosts, sub: "último snapshot" },
    { label: "Flows activos", value: telemetrySummary.activeFlows, sub: "último snapshot" },
  ] : [];

  return (
    <OpsShell eyebrow="Centro de Operaciones" title="Monitoreo de Red">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-ops-border bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_35%),linear-gradient(135deg,#07111d,#0b1727_62%,#08131f)] p-6 shadow-ops">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="relative max-w-2xl">
            <div className="max-w-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Comando Operativo De Red</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Inventario vivo, discovery correlacionado y telemetría con contexto operativo.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Base operacional para NOC: qué equipos existen, cuáles están vivos, qué quedó pendiente y cómo se comporta el nodo.
              </p>
              <p className="mt-4 text-xs font-medium text-slate-400">
                Cobertura: {model.summary.totalNodes} nodos visibles · Discovery: {model.observability.pendingDiscoveries} pendientes · Observabilidad: {model.observability.analyticsConfigured} analíticas configuradas
              </p>
            </div>
          </div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard label="Nodos" value={model.summary.totalNodes} sub={`${model.summary.onlineNodes} en línea`} />
            <StatCard label="Degradados" value={model.summary.degradedNodes} sub="requieren revisión" />
            <StatCard label="Fuera de línea" value={model.summary.offlineNodes} sub="impacto operativo" />
            <StatCard label="Inventario oficial" value={model.summary.officialAssets} sub="equipos registrados" />
            <StatCard label="Pendientes" value={model.observability.pendingDiscoveries} sub="por confirmar" />
            <StatCard label="Último discovery" value={model.observability.latestDiscoveryLabel} sub={detail?.scanSubnetCidr ?? "sin subnet"} />
          </div>
        </section>

        <section className="rounded-[26px] border border-ops-border bg-[linear-gradient(180deg,rgba(8,18,32,0.98),rgba(5,11,22,0.98))] p-4 shadow-ops">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Observabilidad Global</p>
              <h2 className="mt-1 text-lg font-semibold text-ops-text">Comando de red y telemetría consolidada</h2>
            </div>
          </div>
          <GrafanaPanelEmbed
            title={networkEmbed?.title ?? "Comando de red"}
            src={networkEmbed?.src ?? null}
            loading={loadingNetworkEmbed}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr] xl:items-start">
          <section className={`${PANEL_HUD} xl:sticky xl:top-6`}>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-ops-border/80 pb-4">
              <div>
                <p className="mt-1 text-sm font-semibold text-ops-text">Nodos monitoreados</p>
                <p className="text-xs text-ops-muted">Selecciona un nodo para abrir su contexto operativo.</p>
              </div>
              <span className="rounded-full border border-ops-blue/30 bg-ops-blue/10 px-2.5 py-1 font-mono text-[10px] text-ops-blue">{filteredNodes.length}</span>
            </div>
            <input
              className={`${INPUT} mb-3`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar por nodo, ruta o CMC…"
            />
            {loading ? (
              <div className="flex justify-center py-12"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
            ) : (
              <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
                {filteredNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`group relative w-full overflow-hidden rounded-ops border p-3 text-left transition-colors ${
                      node.id === selectedNodeId
                        ? "border-ops-blue bg-[linear-gradient(90deg,rgba(29,78,216,0.24),rgba(15,23,42,0.84)_45%,rgba(2,6,23,0.96))] shadow-ops-glow-blue"
                        : "border-ops-border bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,6,23,0.96))] hover:border-ops-blue/40"
                    }`}
                  >
                    {node.id === selectedNodeId && <span className="absolute inset-y-0 left-0 w-1 bg-ops-blue" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-ops-blue">{node.code}</p>
                          {node.id === selectedNodeId && <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ops-blue">Activo</span>}
                        </div>
                        <p className="truncate text-sm font-semibold text-ops-text">{node.name}</p>
                        <p className="truncate text-[11px] text-ops-muted">{node.route.identifier} · {node.route.center.name}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateBadge(node.operativeState)}`}>
                        {node.operativeState}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-ops-border/70 pt-2 text-[10px] text-ops-dim">
                      <span>{node._count.assets} activos</span>
                      <span className="text-ops-border">/</span>
                      <span>{node._count.discoveryJobs} scans</span>
                      <span className="text-ops-border">/</span>
                      <span>{node._count.analyticsAssignments} analíticas</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/30">
                      <div
                        className={`${node.operativeState === "ONLINE" ? "bg-ops-emerald" : node.operativeState === "DEGRADED" ? "bg-ops-amber" : "bg-ops-rose"} h-full rounded-full`}
                        style={{ width: `${node._count.assets === 0 ? 18 : Math.min(100, 28 + node._count.assets * 11)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {!detail ? (
              <div className={PANEL}>
                <p className="text-sm text-ops-muted">Selecciona un nodo para abrir el monitor operativo.</p>
              </div>
            ) : (
              <>
                <div className={PANEL_HUD}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-blue/80">Nodo seleccionado</p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-2xl font-semibold tracking-tight text-ops-text">{detail.name}</h2>
                        <span className="font-mono text-xs font-semibold tracking-[0.16em] text-ops-blue">{detail.code}</span>
                      </div>
                      <p className="mt-1 text-sm text-ops-muted">
                        {detail.route.identifier} · {detail.route.center.name} · IP {detail.primaryIp ?? "sin definir"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-ops-muted">
                        <span className={`rounded-full border px-2.5 py-1 ${stateBadge(detail.operativeState)}`}>{detail.operativeState}</span>
                        <span className="rounded-full border border-ops-border bg-black/20 px-2.5 py-1">Subnet {detail.scanSubnetCidr ?? "sin CIDR"}</span>
                        <span className="rounded-full border border-ops-border bg-black/20 px-2.5 py-1">{detail.assets.length} activos oficiales</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-ops border border-ops-border bg-black/20 p-2">
                      {loadingDetail && <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" aria-label="Actualizando detalle del nodo" />}
                      <button
                        type="button"
                        onClick={() => void handleRunDiscovery()}
                        disabled={runningDiscovery}
                        className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white shadow-ops-glow-blue hover:bg-ops-blue/80 disabled:opacity-50"
                      >
                        {runningDiscovery ? "Escaneando…" : "Escanear ahora"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-y border-ops-border bg-black/20 px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={tabClass(tab === "inventario")} onClick={() => setTab("inventario")}>Inventario</button>
                    <button type="button" className={tabClass(tab === "trafico")} onClick={() => setTab("trafico")}>Tráfico / Observabilidad</button>
                    <button type="button" className={tabClass(tab === "alertas")} onClick={() => setTab("alertas")}>Alertas</button>
                  </div>
                </div>

                {tab === "inventario" && (
                  <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                    <div className={PANEL_GRID}>
                      <div className="mb-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-ops-text">Inventario correlacionado</p>
                          <p className="text-xs text-ops-muted">Equipos oficiales + hallazgos de discovery pendientes de confirmar.</p>
                        </div>
                        <span className="rounded-full border border-ops-border px-2 py-1 text-[10px] text-ops-muted">{filteredInventory.length} / {model.inventory.length}</span>
                      </div>
                      <input
                        className={`${INPUT} mb-3`}
                        value={inventoryFilter}
                        onChange={(event) => setInventoryFilter(event.target.value)}
                        placeholder="Buscar por nombre, tipo, IP, MAC o fabricante…"
                      />
                      <div className="max-h-[60vh] overflow-y-auto rounded-ops border border-ops-border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="sticky top-0 z-10 border-b border-ops-border bg-black/80 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-ops-muted">
                              <th className="px-4 py-3">Fuente</th>
                              <th className="px-4 py-3">Nombre</th>
                              <th className="px-4 py-3">Tipo</th>
                              <th className="px-4 py-3">IP</th>
                              <th className="px-4 py-3">MAC</th>
                              <th className="px-4 py-3">Fabricante</th>
                              <th className="px-4 py-3">Estado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ops-border">
                            {filteredInventory.map((row) => (
                              <tr key={row.id} className="bg-ops-surface/70 transition hover:bg-ops-surface">
                                <td className="px-4 py-3 text-xs text-ops-muted">
                                  <span className={`rounded-full border px-2 py-1 ${row.source === "OFFICIAL" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-blue/30 bg-ops-blue/10 text-ops-blue"}`}>
                                    {row.source === "OFFICIAL" ? "Oficial" : `Discovery ${row.confidenceLabel}`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-ops-text">{row.name}</td>
                                <td className="px-4 py-3 text-ops-muted">{row.type}</td>
                                <td className="px-4 py-3 font-mono text-xs text-ops-muted">{row.ip}</td>
                                <td className="px-4 py-3 font-mono text-xs text-ops-muted">{row.mac}</td>
                                <td className="px-4 py-3 text-ops-muted">{row.vendor}</td>
                                <td className="px-4 py-3 text-ops-muted">
                                  <span className={`rounded-full border px-2 py-1 text-[10px] ${stateBadge(row.state)}`}>{row.state}</span>
                                </td>
                              </tr>
                            ))}
                            {model.inventory.length === 0 && (
                              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-ops-muted">Sin inventario operativo todavía.</td></tr>
                            )}
                            {model.inventory.length > 0 && filteredInventory.length === 0 && (
                              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-ops-muted">Sin resultados para “{inventoryFilter}”.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className={PANEL_HUD}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ops-text">Pendientes del último escaneo</p>
                          <p className="text-xs text-ops-muted">Confirma o descarta cada equipo antes de incorporarlo al inventario.</p>
                        </div>
                        <span className="rounded-full border border-ops-border px-2 py-1 text-[10px] text-ops-muted">
                          {latestJob?.discoveredDevices.filter((device) => device.status === "DISCOVERED").length ?? 0}
                        </span>
                      </div>
                      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                      {latestJob?.discoveredDevices.filter((device) => device.status === "DISCOVERED").length ? (
                        latestJob.discoveredDevices.filter((device) => device.status === "DISCOVERED").map((device) => (
                          <div key={device.id} className="rounded-ops border border-ops-border bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(2,6,23,0.96))] p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-ops-text">{device.name || device.hostname || device.ip || "Dispositivo descubierto"}</p>
                                <p className="text-xs text-ops-muted">
                                  {(device.candidateType ?? "Sin clasificar")} · {device.ip ?? "sin IP"} · {device.vendor ?? "sin fabricante"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleConfirm(device)}
                                  disabled={resolvingDiscoveryId === device.id}
                                  className="rounded-ops bg-ops-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDismiss(device)}
                                  disabled={resolvingDiscoveryId === device.id}
                                  className="rounded-ops border border-ops-border px-3 py-1.5 text-xs text-ops-muted hover:text-ops-text disabled:opacity-50"
                                >
                                  Descartar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-ops-muted">No hay dispositivos pendientes de confirmar en el último scan.</p>
                      )}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "trafico" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
                      <div className={PANEL_HUD}>
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ops-text">Actividad reciente del nodo</p>
                            <p className="text-xs text-ops-muted">Bytes de entrada/salida, hosts y flujos activos en las últimas capturas.</p>
                          </div>
                          <span className="rounded-full border border-ops-border px-2 py-1 text-[10px] text-ops-muted">
                            {detail?.code} · {detail?.route.identifier}
                          </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          {telemetryPulseCards.map((card, index) => (
                            <TelemetryStrip
                              key={card.label}
                              title={card.label}
                              value={card.value}
                              accentClass={["text-ops-blue", "text-ops-emerald", "text-ops-amber", "text-ops-rose"][index] ?? "text-ops-text"}
                              barClass={["bg-ops-blue", "bg-ops-emerald", "bg-ops-amber", "bg-ops-rose"][index] ?? "bg-ops-blue"}
                              segments={telemetryTimeseries.map((point) => index === 0
                                ? Number(point.totalBytesIn)
                                : index === 1
                                  ? Number(point.totalBytesOut)
                                  : index === 2
                                    ? point.activeHosts
                                    : point.activeFlows)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className={PANEL_GRID}>
                        <p className="text-sm font-semibold text-ops-text">Estado rápido de telemetría</p>
                        <p className="mb-4 text-xs text-ops-muted">Cobertura de datos antes de entrar al detalle completo.</p>
                        <SignalMatrix
                          items={[
                            { label: "Última captura", value: formatDate(telemetrySummary?.capturedAt), tone: "text-ops-text" },
                            { label: "Alertas activas", value: String(telemetrySummary?.alertCount ?? 0), tone: "text-ops-amber" },
                            { label: "Hosts visibles", value: String(telemetrySummary?.activeHosts ?? 0), tone: "text-ops-emerald" },
                            { label: "Flows activos", value: String(telemetrySummary?.activeFlows ?? 0), tone: "text-ops-blue" },
                          ]}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                      <div className={PANEL_GRID}>
                        <p className="text-sm font-semibold text-ops-text">Tráfico por protocolo</p>
                        <p className="mb-4 text-xs text-ops-muted">Protocolos con mayor volumen en el último snapshot de telemetría.</p>
                        {(telemetrySummary?.topProtocols.length ?? 0) > 0 ? (
                          <MiniBarChart
                            items={telemetrySummary?.topProtocols.map((item) => ({ label: item.name, value: item.bytes })) ?? []}
                            colorClass="bg-ops-blue"
                          />
                        ) : (
                          <p className="text-sm text-ops-muted">Todavía no hay protocolos reportados por telemetría.</p>
                        )}
                      </div>

                      <div className={PANEL_GRID}>
                        <p className="text-sm font-semibold text-ops-text">Destinos principales</p>
                        <p className="mb-4 text-xs text-ops-muted">Destinos con mayor volumen en el último snapshot de telemetría.</p>
                        {(telemetrySummary?.topDestinations.length ?? 0) > 0 ? (
                          <MiniBarChart
                            items={telemetrySummary?.topDestinations.map((item) => ({ label: `${item.target} (${item.kind})`, value: item.bytes })) ?? []}
                            colorClass="bg-ops-emerald"
                          />
                        ) : (
                          <p className="text-sm text-ops-muted">Todavía no hay destinos reportados por telemetría.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                      <div className={PANEL_GRID}>
                        <p className="text-sm font-semibold text-ops-text">Hosts por captura</p>
                        <p className="mb-4 text-xs text-ops-muted">Evolución de hosts activos reportados por la telemetría del nodo.</p>
                        {telemetryTimeseries.length > 0 ? (
                          <MiniBarChart
                            items={telemetryTimeseries.map((point) => ({ label: formatDate(point.capturedAt), value: point.activeHosts }))}
                            colorClass="bg-ops-amber"
                          />
                        ) : (
                          <p className="text-sm text-ops-muted">Todavía no hay historial de telemetría para graficar.</p>
                        )}
                      </div>

                      <div className={PANEL_GRID}>
                        <p className="text-sm font-semibold text-ops-text">Activos observados</p>
                        <p className="mb-4 text-xs text-ops-muted">Clasificación de los hosts informados por el último snapshot.</p>
                        {observabilityAssets.length > 0 ? (
                          <MiniBarChart
                            items={["OFFICIAL", "DISCOVERY", "UNMATCHED"].map((source) => ({
                              label: classificationLabel(source),
                              value: observabilityAssets.filter((asset) => asset.classificationSource === source).length,
                            }))}
                            colorClass="bg-ops-rose"
                          />
                        ) : (
                          <p className="text-sm text-ops-muted">Todavía no hay hosts observados por telemetría.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                      <div className={PANEL_GRID}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ops-text">Tendencia de discovery</p>
                            <p className="text-xs text-ops-muted">Resultado de los escaneos recientes para contextualizar la cobertura observada.</p>
                          </div>
                          <span className="rounded-full border border-ops-border bg-black/20 px-2 py-1 text-[10px] text-ops-muted">{model.charts.discoveryTrend.length}</span>
                        </div>
                        {model.charts.discoveryTrend.length > 0 ? (
                          <DiscoveryTrendChart items={model.charts.discoveryTrend} />
                        ) : (
                          <p className="text-sm text-ops-muted">Todavía no hay ejecuciones de discovery para comparar.</p>
                        )}
                      </div>

                      <div className={PANEL_GRID}>
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ops-text">Lectura de cobertura</p>
                            <p className="text-xs text-ops-muted">La clasificación permite distinguir activos oficiales, hallazgos y hosts aún sin correlación.</p>
                          </div>
                          <span className="rounded-full border border-ops-border bg-black/20 px-2 py-1 text-[10px] text-ops-muted">SIGES</span>
                        </div>
                        <SignalMatrix
                          items={[
                            { label: "Activos oficiales", value: String(observabilityAssets.filter((asset) => asset.classificationSource === "OFFICIAL").length), tone: "text-ops-emerald" },
                            { label: "Hallazgos discovery", value: String(observabilityAssets.filter((asset) => asset.classificationSource === "DISCOVERY").length), tone: "text-ops-blue" },
                            { label: "Sin correlación", value: String(observabilityAssets.filter((asset) => asset.classificationSource === "UNMATCHED").length), tone: "text-ops-amber" },
                            { label: "Último snapshot", value: formatDate(telemetrySummary?.capturedAt), tone: "text-ops-text" },
                          ]}
                        />
                      </div>
                    </div>

                    <div className={PANEL_HUD}>
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ops-text">Actividad operativa del nodo</p>
                          <p className="text-xs text-ops-muted">Hosts y volumen observados en el último snapshot de telemetría.</p>
                        </div>
                        <span className="rounded-full border border-ops-border bg-black/20 px-2 py-1 text-[10px] text-ops-muted">{observabilityAssets.length} hosts</span>
                      </div>
                      <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                        {observabilityAssets.map((asset) => (
                          <div key={asset.id} className="rounded-ops border border-ops-border bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.96))] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ops-text">{asset.nodeAsset?.name ?? asset.hostname ?? asset.ip ?? asset.mac ?? "Host observado"}</p>
                                <p className="truncate text-xs text-ops-muted">{asset.nodeAsset?.assetType ?? "Sin correlación"} · {asset.ip ?? "sin IP"} · {asset.mac ?? "sin MAC"}</p>
                              </div>
                              <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${asset.classificationSource === "OFFICIAL" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : asset.classificationSource === "DISCOVERY" ? "border-ops-blue/30 bg-ops-blue/10 text-ops-blue" : "border-ops-amber/30 bg-ops-amber/10 text-ops-amber"}`}>{classificationLabel(asset.classificationSource)}</span>
                            </div>
                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-ops-dim">
                                <span>Tráfico total</span>
                                <span>{formatTelemetryBytes(Number(asset.bytesIn) + Number(asset.bytesOut))}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-black/30">
                                <div
                                  className="h-full rounded-full bg-ops-emerald"
                                  style={{ width: `${Math.max(8, Math.round((Number(asset.bytesOut) / Math.max(1, Number(asset.bytesIn) + Number(asset.bytesOut))) * 100))}%` }}
                                />
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-ops-dim">
                              <span className="rounded border border-ops-border bg-black/20 px-2 py-1">IN {formatTelemetryBytes(asset.bytesIn)}</span>
                              <span className="rounded border border-ops-border bg-black/20 px-2 py-1">OUT {formatTelemetryBytes(asset.bytesOut)}</span>
                              <span className="rounded border border-ops-border bg-black/20 px-2 py-1">{asset.flowCount} flows</span>
                            </div>
                            <p className="mt-2 text-[11px] text-ops-dim">Última actividad visible: {formatDate(asset.lastSeenAt)}</p>
                          </div>
                        ))}
                        {observabilityAssets.length === 0 && <p className="text-sm text-ops-muted">Este nodo aún no reporta hosts en telemetría.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "alertas" && (
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div className={PANEL_HUD}>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ops-text">Alertas de telemetría</p>
                          <p className="text-xs text-ops-muted">Incidentes activos derivados de los snapshots de SIGES para este nodo.</p>
                        </div>
                        <span className="rounded-full border border-ops-border bg-black/20 px-2 py-1 text-[10px] text-ops-muted">{telemetryAlerts.length} activas</span>
                      </div>
                      <div className="space-y-2">
                        {telemetryAlerts.map((alert) => (
                          <div key={alert.id} className={`rounded-ops border p-3 ${ALERT_STYLES[telemetryAlertLevel(alert.severity)]}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{alert.title}</p>
                                <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
                              </div>
                              <span className="rounded-full border border-current/30 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{alert.severity}</span>
                            </div>
                            <p className="mt-2 border-t border-current/15 pt-2 text-[10px] opacity-75">Última detección: {formatDate(alert.lastSeenAt)}</p>
                          </div>
                        ))}
                        {telemetryAlerts.length === 0 && (
                          <div className="rounded-ops border border-ops-emerald/30 bg-ops-emerald/10 p-4 text-sm text-ops-emerald">
                            Sin alertas relevantes en este nodo por ahora.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={PANEL_GRID}>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ops-text">Condiciones operativas</p>
                          <p className="text-xs text-ops-muted">Hallazgos de inventario, discovery y configuración que requieren seguimiento.</p>
                        </div>
                        <span className="rounded-full border border-ops-border bg-black/20 px-2 py-1 text-[10px] text-ops-muted">{model.alerts.length} abiertas</span>
                      </div>
                      <div className="space-y-2">
                        {model.alerts.map((alert) => (
                          <div key={alert.id} className={`rounded-ops border p-3 ${ALERT_STYLES[alert.level]}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{alert.title}</p>
                                <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
                              </div>
                              <span className="rounded-full border border-current/30 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{alert.level}</span>
                            </div>
                          </div>
                        ))}
                        {model.alerts.length === 0 && (
                          <div className="rounded-ops border border-ops-emerald/30 bg-ops-emerald/10 p-4 text-sm text-ops-emerald">
                            Sin condiciones operativas pendientes en este nodo.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </OpsShell>
  );
}
