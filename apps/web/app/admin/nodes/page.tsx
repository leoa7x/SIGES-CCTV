"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OpsNotice } from "../../../components/ops-notice";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { GrafanaPanelEmbed } from "../../../components/grafana-panel-embed";
import { useAuth } from "../../../components/auth-provider";
import { apiDelete, apiGet, apiPatch, apiPost, type GrafanaEmbedDescriptor } from "../../../lib/api";
import { buildGrafanaEmbedModel } from "../../../lib/network-monitor";
import { toUserFacingError } from "../../../lib/presentation";
import { tabClass } from "../../../lib/ui";

type NodeItem = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  primaryIp?: string | null;
  scanSubnetCidr?: string | null;
  nodeType: string;
  operativeState: string;
  hasPole: boolean;
  route: { id: string; identifier: string; center: { name: string } };
  _count: { cameras: number; assets: number; discoveryJobs: number; analyticsAssignments: number };
};

type RouteRef = { id: string; identifier: string; center: { name: string } };

type AnalyticsCatalogItem = {
  id: string;
  code: string;
  name: string;
  scope: "NODE" | "ASSET" | "BOTH";
  isCustom: boolean;
};

type AnalyticsAssignment = {
  id: string;
  customLabel?: string | null;
  isEnabled: boolean;
  notes?: string | null;
  analyticsCatalog: AnalyticsCatalogItem;
};

type NodeAsset = {
  id: string;
  assetType: string;
  name: string;
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  operativeState: string;
  source: string;
  lastSeenAt?: string | null;
  notes?: string | null;
  analyticsAssignments: AnalyticsAssignment[];
};

type DiscoveredDevice = {
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
  matchedAsset?: { id: string; name: string; assetType: string } | null;
};

type DiscoveryJob = {
  id: string;
  status: string;
  targetIp?: string | null;
  targetSubnetCidr?: string | null;
  createdAt: string;
  discoveredDevices: DiscoveredDevice[];
};

type NodeDetail = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  primaryIp?: string | null;
  scanSubnetCidr?: string | null;
  nodeType: string;
  operativeState: string;
  hasPole: boolean;
  route: { id: string; identifier: string; center: { name: string } };
  assets: NodeAsset[];
  discoveryJobs: DiscoveryJob[];
  analyticsAssignments: AnalyticsAssignment[];
};

type NodeForm = {
  code: string;
  name: string;
  lat: string;
  lng: string;
  address: string;
  primaryIp: string;
  scanSubnetCidr: string;
  nodeType: string;
  snmpCommunity: string;
  routeId: string;
  operativeState: string;
  hasPole: boolean;
};

type AssetForm = {
  assetType: string;
  name: string;
  ip: string;
  mac: string;
  vendor: string;
  model: string;
  hostname: string;
  operativeState: string;
  notes: string;
};

type AnalyticsForm = {
  analyticsCatalogId: string;
  customLabel: string;
  notes: string;
};

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const PANEL = "rounded-ops border border-ops-border bg-ops-panel p-4";
const NODE_STATES = ["ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"];
const ASSET_TYPES = ["CAMARA_PTZ", "CAMARA_FIJA", "SWITCH", "UPS"];
const OTHER_ANALYTICS_CODE = "OTHER";

const STATE_COLOR: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function NodesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<NodeItem[]>([]);
  const [routes, setRoutes] = useState<RouteRef[]>([]);
  const [catalog, setCatalog] = useState<AnalyticsCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<NodeItem | null>(null);
  const [editingAsset, setEditingAsset] = useState<NodeAsset | null>(null);
  const [savingNode, setSavingNode] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [deletingNode, setDeletingNode] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const [deletingAnalyticsId, setDeletingAnalyticsId] = useState("");
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [resolvingDiscoveryId, setResolvingDiscoveryId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [nodeForm, setNodeForm] = useState<NodeForm>({
    code: "",
    name: "",
    lat: "",
    lng: "",
    address: "",
    primaryIp: "",
    scanSubnetCidr: "",
    nodeType: "OTHER",
    snmpCommunity: "",
    routeId: "",
    operativeState: "ONLINE",
    hasPole: true,
  });

  const [assetForm, setAssetForm] = useState<AssetForm>({
    assetType: "CAMARA_FIJA",
    name: "",
    ip: "",
    mac: "",
    vendor: "",
    model: "",
    hostname: "",
    operativeState: "ONLINE",
    notes: "",
  });

  const [nodeAnalyticsForm, setNodeAnalyticsForm] = useState<AnalyticsForm>({
    analyticsCatalogId: "",
    customLabel: "",
    notes: "",
  });

  const [assetAnalyticsForm, setAssetAnalyticsForm] = useState<AnalyticsForm>({
    analyticsCatalogId: "",
    customLabel: "",
    notes: "",
  });

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [nodeFilter, setNodeFilter] = useState("");
  const [detailTab, setDetailTab] = useState<"equipos" | "descubrimientos" | "analiticas" | "observabilidad">("equipos");
  const [nodeEmbedDescriptor, setNodeEmbedDescriptor] = useState<GrafanaEmbedDescriptor | null>(null);
  const [loadingNodeEmbed, setLoadingNodeEmbed] = useState(false);

  const selectedAsset = useMemo(
    () => detail?.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [detail, selectedAssetId],
  );

  const nodeEmbed = useMemo(
    () => nodeEmbedDescriptor ? buildGrafanaEmbedModel(nodeEmbedDescriptor) : null,
    [nodeEmbedDescriptor],
  );

  const filteredItems = useMemo(() => {
    const q = nodeFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      item.route.identifier.toLowerCase().includes(q) ||
      item.route.center.name.toLowerCase().includes(q));
  }, [items, nodeFilter]);

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setDetailTab("equipos");
  }

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [nodes, routeData, catalogData] = await Promise.all([
        apiGet<NodeItem[]>("/nodes", accessToken),
        apiGet<RouteRef[]>("/routes", accessToken),
        apiGet<AnalyticsCatalogItem[]>("/analytics-catalog", accessToken),
      ]);
      setItems(nodes);
      setRoutes(routeData);
      setCatalog(catalogData);
      if (!selectedNodeId && nodes[0]?.id) {
        setSelectedNodeId(nodes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedNodeId]);

  const loadDetail = useCallback(async (nodeId: string) => {
    if (!accessToken || !nodeId) return;
    setLoadingDetail(true);
    try {
      const data = await apiGet<NodeDetail>(`/nodes/${nodeId}`, accessToken);
      setDetail(data);
      setSelectedAssetId((current) => current || data.assets[0]?.id || "");
      setAssetAnalyticsForm((current) => ({
        ...current,
        analyticsCatalogId: current.analyticsCatalogId || catalog[0]?.id || "",
      }));
      setNodeAnalyticsForm((current) => ({
        ...current,
        analyticsCatalogId: current.analyticsCatalogId || catalog[0]?.id || "",
      }));
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken, catalog]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedNodeId) void loadDetail(selectedNodeId); }, [selectedNodeId, loadDetail]);
  useEffect(() => {
    if (!accessToken || !selectedNodeId) {
      setNodeEmbedDescriptor(null);
      setLoadingNodeEmbed(false);
      return;
    }

    let cancelled = false;
    setNodeEmbedDescriptor(null);
    setLoadingNodeEmbed(true);

    void apiGet<GrafanaEmbedDescriptor>(`/observability/embed/node/${selectedNodeId}`, accessToken)
      .then((descriptor) => {
        if (!cancelled) setNodeEmbedDescriptor(descriptor);
      })
      .catch(() => {
        if (!cancelled) setNodeEmbedDescriptor(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingNodeEmbed(false);
      });

    return () => { cancelled = true; };
  }, [accessToken, selectedNodeId]);

  function resetNodeForm() {
    setNodeForm({
      code: "",
      name: "",
      lat: "",
      lng: "",
      address: "",
      primaryIp: "",
      scanSubnetCidr: "",
      nodeType: "OTHER",
      snmpCommunity: "",
      routeId: routes[0]?.id ?? "",
      operativeState: "ONLINE",
      hasPole: true,
    });
  }

  function openCreateNode() {
    setEditingNode(null);
    resetNodeForm();
    setNodeModalOpen(true);
  }

  function openEditNode(node: NodeItem) {
    setEditingNode(node);
    setNodeForm({
      code: node.code,
      name: node.name,
      lat: String(node.lat),
      lng: String(node.lng),
      address: "",
      primaryIp: node.primaryIp ?? "",
        scanSubnetCidr: node.scanSubnetCidr ?? "",
        nodeType: "OTHER",
      snmpCommunity: "",
      routeId: node.route.id,
      operativeState: node.operativeState,
      hasPole: node.hasPole,
    });
    setNodeModalOpen(true);
  }

  function openEditAsset(asset: NodeAsset) {
    setEditingAsset(asset);
    setAssetForm({
      assetType: asset.assetType,
      name: asset.name,
      ip: asset.ip ?? "",
      mac: asset.mac ?? "",
      vendor: asset.vendor ?? "",
      model: asset.model ?? "",
      hostname: asset.hostname ?? "",
      operativeState: asset.operativeState,
      notes: asset.notes ?? "",
    });
  }

  function resetAssetForm() {
    setEditingAsset(null);
    setAssetForm({
      assetType: "CAMARA_FIJA",
      name: "",
      ip: "",
      mac: "",
      vendor: "",
      model: "",
      hostname: "",
      operativeState: "ONLINE",
      notes: "",
    });
  }

  async function submitNode(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSavingNode(true);
    try {
      const payload = {
        ...(editingNode ? {} : { code: nodeForm.code }),
        name: nodeForm.name,
        lat: Number(nodeForm.lat),
        lng: Number(nodeForm.lng),
        address: nodeForm.address || undefined,
        primaryIp: nodeForm.primaryIp,
        scanSubnetCidr: nodeForm.scanSubnetCidr || undefined,
        nodeType: nodeForm.nodeType,
        snmpCommunity: nodeForm.snmpCommunity || undefined,
        hasPole: nodeForm.hasPole,
        ...(editingNode ? { operativeState: nodeForm.operativeState } : { routeId: nodeForm.routeId }),
      };

      if (editingNode) {
        await apiPatch(`/nodes/${editingNode.id}`, accessToken, payload);
      } else {
        await apiPost("/nodes", accessToken, payload);
      }

      setNodeModalOpen(false);
      await load();
      if (editingNode) {
        await loadDetail(editingNode.id);
      }
    } finally {
      setSavingNode(false);
    }
  }

  async function submitAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !detail) return;
    setSavingAsset(true);
    try {
      const payload = {
        nodeId: detail.id,
        assetType: assetForm.assetType,
        name: assetForm.name,
        ip: assetForm.ip || undefined,
        mac: assetForm.mac || undefined,
        vendor: assetForm.vendor || undefined,
        model: assetForm.model || undefined,
        hostname: assetForm.hostname || undefined,
        operativeState: assetForm.operativeState,
        notes: assetForm.notes || undefined,
      };

      if (editingAsset) {
        await apiPatch(`/node-assets/${editingAsset.id}`, accessToken, payload);
      } else {
        await apiPost("/node-assets", accessToken, payload);
      }

      resetAssetForm();
      await loadDetail(detail.id);
    } finally {
      setSavingAsset(false);
    }
  }

  async function handleDeleteNode() {
    if (!accessToken || !detail) return;
    const confirmed = window.confirm(`Eliminar el nodo ${detail.code} y todo lo asociado: equipos, cámaras, analíticas, descubrimientos e incidencias relacionadas?`);
    if (!confirmed) return;

    setDeletingNode(true);
    setErrorMessage("");
    try {
      await apiDelete(`/nodes/${detail.id}`, accessToken);
      setDetail(null);
      setSelectedAssetId("");
      const remaining = items.filter((item) => item.id !== detail.id);
      setSelectedNodeId(remaining[0]?.id ?? "");
      await load();
    } catch (error) {
      setErrorMessage(toUserFacingError(error, "No se pudo eliminar el nodo."));
    } finally {
      setDeletingNode(false);
    }
  }

  async function handleDeleteAsset(asset: NodeAsset) {
    if (!accessToken || !detail) return;
    const confirmed = window.confirm(`Eliminar el equipo ${asset.name} del nodo ${detail.code}?`);
    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    try {
      await apiDelete(`/node-assets/${asset.id}`, accessToken);
      if (selectedAssetId === asset.id) {
        setSelectedAssetId("");
      }
      resetAssetForm();
      await loadDetail(detail.id);
    } finally {
      setDeletingAssetId("");
    }
  }

  async function handleRunDiscovery() {
    if (!accessToken || !detail) return;
    setRunningDiscovery(true);
    try {
      await apiPost(`/nodes/${detail.id}/discovery-jobs`, accessToken, {});
      await loadDetail(detail.id);
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleConfirmDiscovery(device: DiscoveredDevice) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(device.id);
    try {
      await apiPost(`/node-discovery/devices/${device.id}/confirm`, accessToken, {
        assetType: device.candidateType || "SWITCH",
        name: device.name || device.hostname || device.candidateType || "Equipo descubierto",
      });
      await loadDetail(detail.id);
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  async function handleDismissDiscovery(device: DiscoveredDevice) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(device.id);
    try {
      await apiPost(`/node-discovery/devices/${device.id}/dismiss`, accessToken, {});
      await loadDetail(detail.id);
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  async function submitNodeAnalytics(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !detail) return;
    setSavingAnalytics(true);
    try {
      const selected = catalog.find((item) => item.id === nodeAnalyticsForm.analyticsCatalogId);
      await apiPost(`/nodes/${detail.id}/analytics`, accessToken, {
        analyticsCatalogId: nodeAnalyticsForm.analyticsCatalogId,
        customLabel: selected?.code === OTHER_ANALYTICS_CODE ? nodeAnalyticsForm.customLabel : undefined,
        notes: nodeAnalyticsForm.notes || undefined,
        isEnabled: true,
      });
      setNodeAnalyticsForm({
        analyticsCatalogId: catalog[0]?.id ?? "",
        customLabel: "",
        notes: "",
      });
      await loadDetail(detail.id);
    } finally {
      setSavingAnalytics(false);
    }
  }

  async function submitAssetAnalytics(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !selectedAsset || !detail) return;
    setSavingAnalytics(true);
    try {
      const selected = catalog.find((item) => item.id === assetAnalyticsForm.analyticsCatalogId);
      await apiPost(`/node-assets/${selectedAsset.id}/analytics`, accessToken, {
        analyticsCatalogId: assetAnalyticsForm.analyticsCatalogId,
        customLabel: selected?.code === OTHER_ANALYTICS_CODE ? assetAnalyticsForm.customLabel : undefined,
        notes: assetAnalyticsForm.notes || undefined,
        isEnabled: true,
      });
      setAssetAnalyticsForm({
        analyticsCatalogId: catalog[0]?.id ?? "",
        customLabel: "",
        notes: "",
      });
      await loadDetail(detail.id);
    } finally {
      setSavingAnalytics(false);
    }
  }

  async function handleDeleteNodeAnalytics(assignment: AnalyticsAssignment) {
    if (!accessToken || !detail) return;
    const label = assignment.customLabel || assignment.analyticsCatalog.name;
    if (!window.confirm(`Eliminar analítica ${label} del nodo ${detail.code}?`)) return;

    setDeletingAnalyticsId(assignment.id);
    try {
      await apiDelete(`/nodes/analytics/${assignment.id}`, accessToken);
      await loadDetail(detail.id);
    } finally {
      setDeletingAnalyticsId("");
    }
  }

  async function handleDeleteAssetAnalytics(assignment: AnalyticsAssignment) {
    if (!accessToken || !selectedAsset || !detail) return;
    const label = assignment.customLabel || assignment.analyticsCatalog.name;
    if (!window.confirm(`Eliminar analítica ${label} del equipo ${selectedAsset.name}?`)) return;

    setDeletingAnalyticsId(assignment.id);
    try {
      await apiDelete(`/node-assets/analytics/${assignment.id}`, accessToken);
      await loadDetail(detail.id);
    } finally {
      setDeletingAnalyticsId("");
    }
  }

  return (
    <OpsShell eyebrow="Administración" title="Nodos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">Nodo = poste con coordenada, red, inventario oficial y analíticas.</p>
        <button onClick={openCreateNode} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo poste
        </button>
      </div>
      {errorMessage ? (
        <div className="mb-4">
          <OpsNotice tone="warning" title="No se puede eliminar el nodo" message={errorMessage} onDismiss={() => setErrorMessage("")} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.45fr] xl:items-start">
        <section className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel xl:sticky xl:top-6">
          <div className="border-b border-ops-border px-4 py-3">
            <p className="mb-3 text-sm font-semibold text-ops-text">Postes / nodos</p>
            <input
              className={`${INPUT} mb-0`}
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              placeholder="Buscar por código, nombre o ruta…"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-ops-border bg-ops-panel text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                    <th className="px-4 py-3">Nodo</th>
                    <th className="px-4 py-3 hidden md:table-cell">Red</th>
                    <th className="px-4 py-3 hidden md:table-cell">Activos</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ops-border">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`cursor-pointer hover:bg-ops-surface ${selectedNodeId === item.id ? "bg-ops-surface" : ""}`}
                      onClick={() => selectNode(item.id)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-ops-text">{item.code}</p>
                        <p className="text-sm text-ops-text">{item.name}</p>
                        <p className="text-[11px] text-ops-muted">{item.route.identifier} · {item.route.center.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="font-mono text-xs text-ops-muted">{item.primaryIp ?? "sin IP"}</p>
                        <p className="text-[11px] text-ops-dim">{item.scanSubnetCidr ?? "sin subred explícita"}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[11px] text-ops-muted">
                        <p>{item._count.assets} oficiales</p>
                        <p>{item._count.analyticsAssignments} analíticas</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditNode(item); }}
                          className="text-[11px] text-ops-blue hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-ops-muted">Sin resultados para “{nodeFilter}”.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {!detail || loadingDetail ? (
            <div className={PANEL}>
              <div className="flex justify-center py-12">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className={PANEL}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Poste</p>
                  <p className="mt-2 font-mono text-sm text-ops-text">{detail.code}</p>
                  <p className="text-lg font-semibold text-ops-text">{detail.name}</p>
                  <p className="mt-2 text-sm text-ops-muted">{detail.route.identifier} · {detail.route.center.name}</p>
                </div>
                <div className={PANEL}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Red del nodo</p>
                  <p className="mt-2 font-mono text-sm text-ops-text">{detail.primaryIp ?? "Sin IP principal"}</p>
                  <p className="text-sm text-ops-muted">{detail.scanSubnetCidr ?? "Sin subred explícita"}</p>
                  <p className="mt-2 text-[11px] text-ops-dim">Lat {detail.lat} · Lng {detail.lng}</p>
                </div>
                <div className={PANEL}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</p>
                  <span className={`mt-2 inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[detail.operativeState] ?? STATE_COLOR.MAINTENANCE}`}>
                    {detail.operativeState}
                  </span>
                  <p className="mt-2 text-sm text-ops-muted">{detail.hasPole ? "Montado en poste" : "Sin marca de poste"}</p>
                  <p className="text-[11px] text-ops-dim">Tipo base: POSTE</p>
                  <button
                    type="button"
                    onClick={handleDeleteNode}
                    disabled={deletingNode}
                    className="mt-3 text-[11px] text-ops-rose hover:underline disabled:opacity-50"
                  >
                    {deletingNode ? "Eliminando nodo…" : "Eliminar nodo"}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className={tabClass(detailTab === "equipos")} onClick={() => setDetailTab("equipos")}>
                  Equipos · {detail.assets.length}
                </button>
                <button type="button" className={tabClass(detailTab === "descubrimientos")} onClick={() => setDetailTab("descubrimientos")}>
                  Descubrimientos · {detail.discoveryJobs.length}
                </button>
                <button type="button" className={tabClass(detailTab === "analiticas")} onClick={() => setDetailTab("analiticas")}>
                  Analíticas · {detail.analyticsAssignments.length}
                </button>
                <button type="button" className={tabClass(detailTab === "observabilidad")} onClick={() => setDetailTab("observabilidad")}>
                  Observabilidad
                </button>
              </div>

              {detailTab === "equipos" && (
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className={PANEL}>
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-semibold text-ops-text">Equipos oficiales</p>
                      <button onClick={resetAssetForm} className="text-[11px] text-ops-blue hover:underline">Nuevo activo</button>
                    </div>
                    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                      {detail.assets.length === 0 ? (
                        <p className="text-sm text-ops-muted">Aún no hay inventario oficial para este poste.</p>
                      ) : detail.assets.map((asset) => (
                        <div key={asset.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-ops-blue">{asset.assetType}</p>
                              <p className="text-sm font-medium text-ops-text">{asset.name}</p>
                              <p className="font-mono text-[11px] text-ops-muted">{asset.ip ?? "sin IP"} · {asset.mac ?? "sin MAC"}</p>
                              <p className="text-[11px] text-ops-dim">{asset.vendor ?? "sin marca"} · {asset.model ?? "sin modelo"}</p>
                              <p className="text-[11px] text-ops-dim">Último visto: {formatDate(asset.lastSeenAt)}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[asset.operativeState] ?? STATE_COLOR.MAINTENANCE}`}>
                                {asset.operativeState}
                              </span>
                              <button onClick={() => { setSelectedAssetId(asset.id); openEditAsset(asset); }} className="mt-2 block text-[11px] text-ops-blue hover:underline">
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteAsset(asset)}
                                disabled={deletingAssetId === asset.id}
                                className="mt-1 block text-[11px] text-ops-rose hover:underline disabled:opacity-50"
                              >
                                {deletingAssetId === asset.id ? "Eliminando…" : "Eliminar"}
                              </button>
                            </div>
                          </div>
                          {asset.analyticsAssignments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {asset.analyticsAssignments.map((assignment) => (
                                <span key={assignment.id} className="rounded border border-ops-blue/30 bg-ops-blue/10 px-2 py-0.5 text-[10px] text-ops-blue">
                                  {assignment.customLabel || assignment.analyticsCatalog.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                </div>

                <div className={PANEL}>
                  <p className="mb-4 text-sm font-semibold text-ops-text">{editingAsset ? "Editar activo" : "Crear activo oficial"}</p>
                  <form onSubmit={submitAsset} className="space-y-3">
                    <select className={INPUT} value={assetForm.assetType} onChange={(e) => setAssetForm((f) => ({ ...f, assetType: e.target.value }))}>
                      {ASSET_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <input className={INPUT} value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nombre del equipo" required />
                    <div className="grid grid-cols-2 gap-3">
                      <input className={INPUT} value={assetForm.ip} onChange={(e) => setAssetForm((f) => ({ ...f, ip: e.target.value }))} placeholder="IP" />
                      <input className={INPUT} value={assetForm.mac} onChange={(e) => setAssetForm((f) => ({ ...f, mac: e.target.value }))} placeholder="MAC" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input className={INPUT} value={assetForm.vendor} onChange={(e) => setAssetForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Marca" />
                      <input className={INPUT} value={assetForm.model} onChange={(e) => setAssetForm((f) => ({ ...f, model: e.target.value }))} placeholder="Modelo" />
                    </div>
                    <input className={INPUT} value={assetForm.hostname} onChange={(e) => setAssetForm((f) => ({ ...f, hostname: e.target.value }))} placeholder="Hostname" />
                    <select className={INPUT} value={assetForm.operativeState} onChange={(e) => setAssetForm((f) => ({ ...f, operativeState: e.target.value }))}>
                      {NODE_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                    </select>
                    <textarea className={INPUT} value={assetForm.notes} onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notas" rows={3} />
                    <div className="flex justify-end gap-2">
                      {editingAsset && (
                        <button type="button" onClick={resetAssetForm} className="rounded-ops border border-ops-border px-3 py-2 text-sm text-ops-muted">
                          Cancelar edición
                        </button>
                      )}
                      <button type="submit" disabled={savingAsset} className="rounded-ops bg-ops-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {savingAsset ? "Guardando…" : editingAsset ? "Actualizar activo" : "Agregar activo"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
              )}

              {detailTab === "descubrimientos" && (
              <div className={PANEL}>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ops-text">Descubrimientos pendientes</p>
                  <button
                    type="button"
                    onClick={handleRunDiscovery}
                    disabled={runningDiscovery}
                    className="text-[11px] text-ops-blue hover:underline disabled:opacity-50"
                  >
                    {runningDiscovery ? "Escaneando…" : "Escanear ahora"}
                  </button>
                </div>
                    {detail.discoveryJobs.length === 0 ? (
                      <p className="text-sm text-ops-muted">Todavía no hay escaneos ejecutados para este nodo.</p>
                    ) : (
                      <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
                        {detail.discoveryJobs.map((job) => (
                          <div key={job.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-ops-text">Job {job.status}</p>
                                <p className="font-mono text-[11px] text-ops-muted">{job.targetSubnetCidr || job.targetIp || "sin objetivo registrado"}</p>
                              </div>
                              <p className="text-[11px] text-ops-dim">{formatDate(job.createdAt)}</p>
                            </div>
                            <div className="mt-2 space-y-2">
                              {job.discoveredDevices.length === 0 ? (
                                <p className="text-[11px] text-ops-dim">Sin dispositivos descubiertos aún.</p>
                              ) : job.discoveredDevices.map((device) => (
                                <div key={device.id} className="rounded border border-ops-border px-2 py-2 text-[11px] text-ops-muted">
                                  <p>{(device.candidateType || "CANDIDATO")} · {device.ip ?? "sin IP"} · {device.mac ?? "sin MAC"} · confianza {device.discoveryConfidence}</p>
                                  <p className="text-[10px] text-ops-dim">{device.vendor ?? "sin marca"} · {device.model ?? "sin modelo"} · estado {device.status}</p>
                                  {device.matchedAsset && (
                                    <p className="text-[10px] text-ops-blue">Relacionado con {device.matchedAsset.assetType} · {device.matchedAsset.name}</p>
                                  )}
                                  {device.status === "DISCOVERED" && (
                                    <div className="mt-2 flex gap-3">
                                      <button
                                        type="button"
                                        onClick={() => void handleConfirmDiscovery(device)}
                                        disabled={resolvingDiscoveryId === device.id}
                                        className="text-ops-blue hover:underline disabled:opacity-50"
                                      >
                                        {resolvingDiscoveryId === device.id ? "Procesando…" : "Confirmar"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDismissDiscovery(device)}
                                        disabled={resolvingDiscoveryId === device.id}
                                        className="text-ops-rose hover:underline disabled:opacity-50"
                                      >
                                        Descartar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {detailTab === "analiticas" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className={PANEL}>
                    <p className="mb-4 text-sm font-semibold text-ops-text">Analíticas del nodo</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {detail.analyticsAssignments.map((assignment) => (
                        <span key={assignment.id} className="inline-flex items-center gap-2 rounded border border-ops-blue/30 bg-ops-blue/10 px-2 py-0.5 text-[10px] text-ops-blue">
                          {assignment.customLabel || assignment.analyticsCatalog.name}
                          <button
                            type="button"
                            onClick={() => void handleDeleteNodeAnalytics(assignment)}
                            disabled={deletingAnalyticsId === assignment.id}
                            className="text-ops-rose hover:underline disabled:opacity-50"
                          >
                            {deletingAnalyticsId === assignment.id ? "…" : "Eliminar analítica"}
                          </button>
                        </span>
                      ))}
                      {detail.analyticsAssignments.length === 0 && <p className="text-sm text-ops-muted">Sin analíticas generales aún.</p>}
                    </div>
                    <form onSubmit={submitNodeAnalytics} className="space-y-3">
                      <select className={INPUT} value={nodeAnalyticsForm.analyticsCatalogId} onChange={(e) => setNodeAnalyticsForm((f) => ({ ...f, analyticsCatalogId: e.target.value }))}>
                        {catalog.filter((item) => item.scope !== "ASSET").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      {(catalog.find((item) => item.id === nodeAnalyticsForm.analyticsCatalogId)?.code === OTHER_ANALYTICS_CODE) && (
                        <input className={INPUT} value={nodeAnalyticsForm.customLabel} onChange={(e) => setNodeAnalyticsForm((f) => ({ ...f, customLabel: e.target.value }))} placeholder="Escribe la otra analítica" required />
                      )}
                      <input className={INPUT} value={nodeAnalyticsForm.notes} onChange={(e) => setNodeAnalyticsForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notas" />
                      <button type="submit" disabled={savingAnalytics} className="rounded-ops bg-ops-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        Agregar analítica al nodo
                      </button>
                    </form>
                  </div>

                  <div className={PANEL}>
                    <p className="mb-4 text-sm font-semibold text-ops-text">Analíticas por equipo</p>
                    <select className={INPUT} value={selectedAssetId} onChange={(e) => setSelectedAssetId(e.target.value)}>
                      <option value="">Seleccionar activo…</option>
                      {detail.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetType} · {asset.name}</option>)}
                    </select>
                    {selectedAsset ? (
                      <>
                        <div className="my-3 flex flex-wrap gap-2">
                          {selectedAsset.analyticsAssignments.map((assignment) => (
                            <span key={assignment.id} className="inline-flex items-center gap-2 rounded border border-ops-amber/30 bg-ops-amber/10 px-2 py-0.5 text-[10px] text-ops-amber">
                              {assignment.customLabel || assignment.analyticsCatalog.name}
                              <button
                                type="button"
                                onClick={() => void handleDeleteAssetAnalytics(assignment)}
                                disabled={deletingAnalyticsId === assignment.id}
                                className="text-ops-rose hover:underline disabled:opacity-50"
                              >
                                {deletingAnalyticsId === assignment.id ? "…" : "Eliminar analítica"}
                              </button>
                            </span>
                          ))}
                          {selectedAsset.analyticsAssignments.length === 0 && <p className="text-sm text-ops-muted">Este equipo no tiene analíticas aún.</p>}
                        </div>
                        <form onSubmit={submitAssetAnalytics} className="space-y-3">
                          <select className={INPUT} value={assetAnalyticsForm.analyticsCatalogId} onChange={(e) => setAssetAnalyticsForm((f) => ({ ...f, analyticsCatalogId: e.target.value }))}>
                            {catalog.filter((item) => item.scope !== "NODE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                          {(catalog.find((item) => item.id === assetAnalyticsForm.analyticsCatalogId)?.code === OTHER_ANALYTICS_CODE) && (
                            <input className={INPUT} value={assetAnalyticsForm.customLabel} onChange={(e) => setAssetAnalyticsForm((f) => ({ ...f, customLabel: e.target.value }))} placeholder="Escribe la otra analítica" required />
                          )}
                          <input className={INPUT} value={assetAnalyticsForm.notes} onChange={(e) => setAssetAnalyticsForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notas" />
                          <button type="submit" disabled={savingAnalytics} className="rounded-ops bg-ops-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                            Agregar analítica al equipo
                          </button>
                        </form>
                      </>
                    ) : (
                      <p className="text-sm text-ops-muted">Selecciona un activo oficial para gestionar sus analíticas.</p>
                    )}
                  </div>
                </div>
              )}

              {detailTab === "observabilidad" && (
                <GrafanaPanelEmbed
                  title={nodeEmbed?.title ?? "Observabilidad del nodo"}
                  src={nodeEmbed?.src ?? null}
                  loading={loadingNodeEmbed}
                />
              )}
            </>
          )}
        </section>
      </div>

      <OpsModal open={nodeModalOpen} title={editingNode ? `Editar ${editingNode.code}` : "Nuevo nodo / poste"} onClose={() => setNodeModalOpen(false)}>
        <form onSubmit={submitNode} className="space-y-4">
          {!editingNode && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código</label>
              <input className={INPUT} value={nodeForm.code} onChange={(e) => setNodeForm((f) => ({ ...f, code: e.target.value }))} required />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={nodeForm.name} onChange={(e) => setNodeForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className={INPUT} value={nodeForm.lat} onChange={(e) => setNodeForm((f) => ({ ...f, lat: e.target.value }))} placeholder="Latitud" required />
            <input className={INPUT} value={nodeForm.lng} onChange={(e) => setNodeForm((f) => ({ ...f, lng: e.target.value }))} placeholder="Longitud" required />
          </div>
          <input className={INPUT} value={nodeForm.address} onChange={(e) => setNodeForm((f) => ({ ...f, address: e.target.value }))} placeholder="Dirección / referencia" />
          <div className="grid grid-cols-2 gap-3">
            <input className={INPUT} value={nodeForm.primaryIp} onChange={(e) => setNodeForm((f) => ({ ...f, primaryIp: e.target.value }))} placeholder="IP principal" required />
            <input className={INPUT} value={nodeForm.scanSubnetCidr} onChange={(e) => setNodeForm((f) => ({ ...f, scanSubnetCidr: e.target.value }))} placeholder="Subred opcional 192.168.1.0/24" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-muted">
              Poste físico
            </div>
            {editingNode ? (
              <select className={INPUT} value={nodeForm.operativeState} onChange={(e) => setNodeForm((f) => ({ ...f, operativeState: e.target.value }))}>
                {NODE_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            ) : (
              <select className={INPUT} value={nodeForm.routeId} onChange={(e) => setNodeForm((f) => ({ ...f, routeId: e.target.value }))} required>
                <option value="">Ruta…</option>
                {routes.map((route) => <option key={route.id} value={route.id}>{route.identifier} — {route.center.name}</option>)}
              </select>
            )}
          </div>
          <input className={INPUT} value={nodeForm.snmpCommunity} onChange={(e) => setNodeForm((f) => ({ ...f, snmpCommunity: e.target.value }))} placeholder="SNMP community opcional" />
          <label className="flex items-center gap-2 text-sm text-ops-muted">
            <input type="checkbox" checked={nodeForm.hasPole} onChange={(e) => setNodeForm((f) => ({ ...f, hasPole: e.target.checked }))} />
            Confirmar que este nodo es un poste físico
          </label>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setNodeModalOpen(false)} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted">
              Cancelar
            </button>
            <button type="submit" disabled={savingNode} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {savingNode ? "Guardando…" : editingNode ? "Guardar cambios" : "Crear nodo"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
