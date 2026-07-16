"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { OpsNotice } from "../../../components/ops-notice";
import { useAuth } from "../../../components/auth-provider";
import { apiDelete, apiGet, apiPatch, apiPost, type CenterAsset, type CenterDiscoveryJob } from "../../../lib/api";
import { formatLifecycleState, toUserFacingError } from "../../../lib/presentation";

type CenterItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  lat: number | null;
  lng: number | null;
  primaryIp: string | null;
  scanSubnetCidr: string | null;
  state: string;
  project: { id: string; name: string; city: { name: string } };
  _count: { routes: number; centerAssets: number };
};
type CenterDetail = CenterItem & {
  routes: Array<{ id: string; identifier: string; _count: { nodes: number } }>;
  centerAssets: CenterAsset[];
  discoveryJobs: CenterDiscoveryJob[];
};
type ProjectRef = { id: string; name: string };
type CreateForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; primaryIp: string; scanSubnetCidr: string; projectId: string;
};
type EditForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; primaryIp: string; scanSubnetCidr: string; state: string;
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
type Feedback = { tone: "error" | "info"; title: string; message: string } | null;

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const ASSET_TYPES = ["CAMARA_FIJA", "CAMARA_PTZ", "SWITCH", "UPS", "OTHER"];
const NODE_STATES = ["ONLINE", "DEGRADED", "OFFLINE", "MAINTENANCE"];

const EMPTY_CREATE: CreateForm = {
  name: "", address: "", phone: "", contactName: "", lat: "", lng: "", primaryIp: "", scanSubnetCidr: "", projectId: "",
};
const EMPTY_ASSET: AssetForm = {
  assetType: "SWITCH",
  name: "",
  ip: "",
  mac: "",
  vendor: "",
  model: "",
  hostname: "",
  operativeState: "ONLINE",
  notes: "",
};

function formatAssetType(value: string) {
  return value.replaceAll("_", " ");
}

export default function CentersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CenterItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CenterItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", address: "", phone: "", contactName: "", lat: "", lng: "", primaryIp: "", scanSubnetCidr: "", state: "ACTIVE",
  });
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [detail, setDetail] = useState<CenterDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<CenterAsset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetForm>(EMPTY_ASSET);
  const [saving, setSaving] = useState(false);
  const [savingAsset, setSavingAsset] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [resolvingDiscoveryId, setResolvingDiscoveryId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError("");
    try {
      const [c, p] = await Promise.all([
        apiGet<CenterItem[]>("/monitoring-centers", accessToken),
        apiGet<ProjectRef[]>("/projects", accessToken),
      ]);
      setItems(c); setProjects(p);
      setSelectedCenterId((current) => current || c[0]?.id || "");
    } catch (err) {
      setLoadError(toUserFacingError(err, "No se pudieron cargar los centros de monitoreo."));
    } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);
  const loadDetail = useCallback(async (centerId: string) => {
    if (!accessToken || !centerId) return;
    setLoadingDetail(true);
    try {
      const data = await apiGet<CenterDetail>(`/monitoring-centers/${centerId}`, accessToken);
      setDetail(data);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo cargar el inventario del CMC",
        message: toUserFacingError(err, "Inténtalo nuevamente en unos segundos."),
      });
    } finally {
      setLoadingDetail(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (selectedCenterId) {
      void loadDetail(selectedCenterId);
    } else {
      setDetail(null);
    }
  }, [selectedCenterId, loadDetail]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ ...EMPTY_CREATE, projectId: projects[0]?.id ?? "" });
    setFeedback(null);
    setModalOpen(true);
  }

  function openEdit(item: CenterItem) {
    setEditing(item);
    setEditForm({
      name: item.name,
      address: item.address ?? "",
      phone: item.phone ?? "",
      contactName: item.contactName ?? "",
      lat: item.lat != null ? String(item.lat) : "",
      lng: item.lng != null ? String(item.lng) : "",
      primaryIp: item.primaryIp ?? "",
      scanSubnetCidr: item.scanSubnetCidr ?? "",
      state: item.state,
    });
    setFeedback(null);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }
  function closeAssetModal() { setAssetModalOpen(false); }

  function parseOptionalNumber(s: string): number | undefined {
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }

  function selectCenter(centerId: string) {
    setSelectedCenterId(centerId);
    setFeedback(null);
  }

  function openAssetCreate() {
    if (!detail) return;
    setEditingAsset(null);
    setAssetForm(EMPTY_ASSET);
    setFeedback(null);
    setAssetModalOpen(true);
  }

  function openAssetEdit(asset: CenterAsset) {
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
    setFeedback(null);
    setAssetModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/monitoring-centers/${editing.id}`, accessToken, {
          name: editForm.name,
          address: editForm.address || undefined,
          phone: editForm.phone || undefined,
          contactName: editForm.contactName || undefined,
          lat: parseOptionalNumber(editForm.lat),
          lng: parseOptionalNumber(editForm.lng),
          primaryIp: editForm.primaryIp || null,
          scanSubnetCidr: editForm.scanSubnetCidr || null,
          state: editForm.state,
        });
      } else {
        await apiPost("/monitoring-centers", accessToken, {
          name: createForm.name,
          address: createForm.address || undefined,
          phone: createForm.phone || undefined,
          contactName: createForm.contactName || undefined,
          lat: parseOptionalNumber(createForm.lat),
          lng: parseOptionalNumber(createForm.lng),
          primaryIp: createForm.primaryIp,
          scanSubnetCidr: createForm.scanSubnetCidr,
          projectId: createForm.projectId,
        });
      }
      closeModal();
      await load();
      if (editing) {
        await loadDetail(editing.id);
      }
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo guardar el CMC",
        message: toUserFacingError(err, "No se pudo guardar el centro de monitoreo."),
      });
    } finally { setSaving(false); }
  }

  async function handleAssetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !detail) return;
    setSavingAsset(true);
    try {
      const payload = {
        centerId: detail.id,
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
        await apiPatch(`/center-assets/${editingAsset.id}`, accessToken, payload);
      } else {
        await apiPost("/center-assets", accessToken, payload);
      }

      closeAssetModal();
      await Promise.all([load(), loadDetail(detail.id)]);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: editingAsset ? "No se pudo actualizar el equipo" : "No se pudo crear el equipo",
        message: toUserFacingError(err, "No se pudo guardar el equipo del CMC."),
      });
    } finally {
      setSavingAsset(false);
    }
  }

  async function handleDeleteAsset(asset: CenterAsset) {
    if (!accessToken || !detail) return;
    if (!window.confirm(`¿Eliminar el equipo "${asset.name}" del CMC?`)) return;
    setDeletingAssetId(asset.id);
    try {
      await apiDelete(`/center-assets/${asset.id}`, accessToken);
      await Promise.all([load(), loadDetail(detail.id)]);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo eliminar el equipo",
        message: toUserFacingError(err, "No se pudo eliminar el equipo del CMC."),
      });
    } finally {
      setDeletingAssetId("");
    }
  }

  async function handleRunCenterDiscovery() {
    if (!accessToken || !detail) return;
    setRunningDiscovery(true);
    try {
      await apiPost(`/monitoring-centers/${detail.id}/discovery-jobs`, accessToken, {});
      await loadDetail(detail.id);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo ejecutar el discovery del CMC",
        message: toUserFacingError(err, "No se pudo ejecutar el discovery del CMC."),
      });
    } finally {
      setRunningDiscovery(false);
    }
  }

  async function handleConfirmDiscovery(deviceId: string, device: CenterDiscoveryJob["discoveredDevices"][number]) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(deviceId);
    try {
      await apiPost(`/center-discovery/devices/${deviceId}/confirm`, accessToken, {
        assetType: device.candidateType || "SWITCH",
        name: device.name || device.hostname || device.candidateType || "Equipo descubierto",
      });
      await Promise.all([load(), loadDetail(detail.id)]);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo confirmar el equipo descubierto",
        message: toUserFacingError(err, "No se pudo confirmar el equipo descubierto."),
      });
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  async function handleDismissDiscovery(deviceId: string) {
    if (!accessToken || !detail) return;
    setResolvingDiscoveryId(deviceId);
    try {
      await apiPost(`/center-discovery/devices/${deviceId}/dismiss`, accessToken, {});
      await loadDetail(detail.id);
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo descartar el equipo descubierto",
        message: toUserFacingError(err, "No se pudo descartar el equipo descubierto."),
      });
    } finally {
      setResolvingDiscoveryId("");
    }
  }

  const pendingDiscoveries = detail?.discoveryJobs.flatMap((job) =>
    job.discoveredDevices.filter((device) => device.status === "DISCOVERED"),
  ) ?? [];

  return (
    <OpsShell eyebrow="Administración" title="Centros de Monitoreo (CMC)">
      {loadError ? (
        <div className="mb-4">
          <OpsNotice tone="error" title="No se pudo cargar la información" message={loadError} onDismiss={() => setLoadError("")} />
        </div>
      ) : null}
      {feedback ? (
        <div className="mb-4">
          <OpsNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onDismiss={() => setFeedback(null)} />
        </div>
      ) : null}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} centros</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo CMC
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Proyecto / Ciudad</th>
                <th className="px-4 py-3 hidden md:table-cell">Dirección</th>
                <th className="px-4 py-3 hidden lg:table-cell">Contacto</th>
                <th className="px-4 py-3 hidden lg:table-cell">GIS</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Equipos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className={`hover:bg-ops-surface ${selectedCenterId === item.id ? "bg-ops-surface/70" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ops-text">{item.name}</p>
                    {item.phone && <p className="text-[10px] text-ops-muted">{item.phone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ops-muted">
                    {item.project.name} · {item.project.city.name}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ops-muted max-w-[180px] truncate">
                    {item.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-ops-muted">
                    {item.contactName ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {item.lat != null && item.lng != null ? (
                      <span className="rounded border border-ops-emerald/30 bg-ops-emerald/10 px-1.5 py-0.5 text-[9px] text-ops-emerald">GIS ✓</span>
                    ) : (
                      <span className="rounded border border-ops-border bg-ops-surface px-1.5 py-0.5 text-[9px] text-ops-dim">sin coord</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.routes}</td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.centerAssets}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {formatLifecycleState(item.state)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => selectCenter(item.id)} className="text-[11px] text-ops-muted hover:text-ops-text hover:underline">Equipos</button>
                      <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-6 rounded-ops border border-ops-border bg-ops-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ops-text">Equipos del CMC</p>
            <p className="text-xs text-ops-muted">
              {detail ? `${detail.name} · ${detail.project.city.name}` : "Selecciona un centro para administrar su inventario interno."}
            </p>
          </div>
          <button
            onClick={openAssetCreate}
            disabled={!detail}
            className="rounded-ops border border-ops-border px-3 py-1.5 text-xs text-ops-muted hover:border-ops-blue hover:text-ops-blue disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nuevo equipo
          </button>
        </div>

        {loadingDetail ? (
          <div className="flex justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
          </div>
        ) : !detail ? (
          <div className="rounded-ops border border-dashed border-ops-border bg-ops-surface px-4 py-6 text-sm text-ops-muted">
            No hay un CMC seleccionado.
          </div>
        ) : detail.centerAssets.length === 0 ? (
          <div className="rounded-ops border border-dashed border-ops-border bg-ops-surface px-4 py-6 text-sm text-ops-muted">
            Este centro todavía no tiene equipos oficiales registrados.
          </div>
        ) : (
          <div className="space-y-2">
            {detail.centerAssets.map((asset) => (
              <div key={asset.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ops-text">{asset.name}</p>
                      <span className="rounded border border-ops-border px-2 py-0.5 text-[10px] text-ops-muted">
                        {formatAssetType(asset.assetType)}
                      </span>
                      <span className="rounded border border-ops-border px-2 py-0.5 text-[10px] text-ops-muted">
                        {asset.operativeState}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-ops-muted">
                      {asset.ip ?? "sin IP"} · {asset.mac ?? "sin MAC"} · {asset.vendor ?? "sin fabricante"} · {asset.model ?? "sin modelo"}
                    </p>
                    {asset.hostname || asset.notes ? (
                      <p className="mt-1 text-[11px] text-ops-dim">
                        {[asset.hostname ? `host ${asset.hostname}` : "", asset.notes ?? ""].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <button onClick={() => openAssetEdit(asset)} className="text-ops-blue hover:underline">Editar</button>
                    <button
                      onClick={() => handleDeleteAsset(asset)}
                      disabled={deletingAssetId === asset.id}
                      className="text-ops-rose hover:underline disabled:opacity-50"
                    >
                      {deletingAssetId === asset.id ? "Eliminando…" : "Eliminar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-ops border border-ops-border bg-ops-panel p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ops-text">Descubrimientos del CMC</p>
            <p className="text-xs text-ops-muted">
              {detail?.scanSubnetCidr ?? detail?.primaryIp ?? "Configura una IP principal o subnet CIDR para escanear."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleRunCenterDiscovery()}
            disabled={!detail || runningDiscovery}
            className="rounded-ops bg-ops-blue px-3 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningDiscovery ? "Escaneando…" : "Escanear ahora"}
          </button>
        </div>

        {loadingDetail ? null : !detail ? (
          <div className="rounded-ops border border-dashed border-ops-border bg-ops-surface px-4 py-6 text-sm text-ops-muted">
            Selecciona un CMC para consultar descubrimientos.
          </div>
        ) : detail.discoveryJobs.length === 0 ? (
          <div className="rounded-ops border border-dashed border-ops-border bg-ops-surface px-4 py-6 text-sm text-ops-muted">
            Todavía no hay escaneos ejecutados para este CMC.
          </div>
        ) : (
          <div className="space-y-2">
            {pendingDiscoveries.map((device) => (
              <div key={device.id} className="rounded-ops border border-ops-border bg-ops-surface p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ops-text">{device.name ?? device.hostname ?? device.ip ?? "Equipo descubierto"}</p>
                    <p className="mt-1 text-[11px] text-ops-muted">
                      {device.candidateType ?? "CANDIDATO"} · {device.ip ?? "sin IP"} · {device.mac ?? "sin MAC"} · confianza {device.discoveryConfidence}
                    </p>
                    <p className="mt-1 text-[10px] text-ops-dim">{device.vendor ?? "sin marca"} · {device.model ?? "sin modelo"}</p>
                    {device.matchedAsset ? <p className="mt-1 text-[10px] text-ops-blue">Relacionado con {device.matchedAsset.assetType} · {device.matchedAsset.name}</p> : null}
                  </div>
                  <div className="flex gap-3 text-[11px]">
                    <button
                      type="button"
                      onClick={() => void handleConfirmDiscovery(device.id, device)}
                      disabled={resolvingDiscoveryId === device.id}
                      className="text-ops-blue hover:underline disabled:opacity-50"
                    >
                      {resolvingDiscoveryId === device.id ? "Procesando…" : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDismissDiscovery(device.id)}
                      disabled={resolvingDiscoveryId === device.id}
                      className="text-ops-rose hover:underline disabled:opacity-50"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingDiscoveries.length === 0 ? (
              <p className="text-sm text-ops-muted">No hay equipos pendientes por confirmar en los escaneos recientes.</p>
            ) : null}
          </div>
        )}
      </section>

      <OpsModal open={modalOpen} title={editing ? "Editar CMC" : "Nuevo CMC"} onClose={closeModal} saving={saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name} required placeholder="CMC Central"
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          {/* Project (create only) */}
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Proyecto</label>
              <select className={INPUT} value={createForm.projectId}
                onChange={(e) => setCreateForm((f) => ({ ...f, projectId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Address */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Dirección</label>
            <input className={INPUT} value={editing ? editForm.address : createForm.address} placeholder="Calle 1 # 2-3"
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, address: e.target.value })) : setCreateForm((f) => ({ ...f, address: e.target.value }))} />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Responsable</label>
              <input className={INPUT} value={editing ? editForm.contactName : createForm.contactName} placeholder="Nombre del operador"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, contactName: e.target.value })) : setCreateForm((f) => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Teléfono</label>
              <input className={INPUT} value={editing ? editForm.phone : createForm.phone} placeholder="601 123 4567"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, phone: e.target.value })) : setCreateForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>

          {/* GIS coordinates */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              Coordenadas GIS{!editing && <span className="ml-1 font-normal text-ops-dim">(auto-geocodificadas al crear si se dejan vacías)</span>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className={INPUT} value={editing ? editForm.lat : createForm.lat} placeholder="Latitud (ej. 4.0756)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lat: e.target.value })) : setCreateForm((f) => ({ ...f, lat: e.target.value }))} />
              <input className={INPUT} value={editing ? editForm.lng : createForm.lng} placeholder="Longitud (ej. -72.0836)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lng: e.target.value })) : setCreateForm((f) => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP principal</label>
              <input className={INPUT} value={editing ? editForm.primaryIp : createForm.primaryIp} placeholder="10.10.10.1"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, primaryIp: e.target.value })) : setCreateForm((f) => ({ ...f, primaryIp: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Subnet CIDR</label>
              <input className={INPUT} value={editing ? editForm.scanSubnetCidr : createForm.scanSubnetCidr} placeholder="10.10.10.0/24"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, scanSubnetCidr: e.target.value })) : setCreateForm((f) => ({ ...f, scanSubnetCidr: e.target.value }))} />
            </div>
          </div>

          {/* State (edit only) */}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state}
                onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">{formatLifecycleState("ACTIVE")}</option>
                <option value="INACTIVE">{formatLifecycleState("INACTIVE")}</option>
                <option value="ARCHIVED">{formatLifecycleState("ARCHIVED")}</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal}
              className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>

      <OpsModal open={assetModalOpen} title={editingAsset ? "Editar equipo del CMC" : "Nuevo equipo del CMC"} onClose={closeAssetModal} saving={savingAsset}>
        <form onSubmit={handleAssetSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
              <select className={INPUT} value={assetForm.assetType} onChange={(e) => setAssetForm((f) => ({ ...f, assetType: e.target.value }))}>
                {ASSET_TYPES.map((type) => <option key={type} value={type}>{formatAssetType(type)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado operativo</label>
              <select className={INPUT} value={assetForm.operativeState} onChange={(e) => setAssetForm((f) => ({ ...f, operativeState: e.target.value }))}>
                {NODE_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={assetForm.name} required placeholder="Core Switch CMC" onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP</label>
              <input className={INPUT} value={assetForm.ip} placeholder="10.10.10.2" onChange={(e) => setAssetForm((f) => ({ ...f, ip: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">MAC</label>
              <input className={INPUT} value={assetForm.mac} placeholder="AA:BB:CC:DD:EE:FF" onChange={(e) => setAssetForm((f) => ({ ...f, mac: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Fabricante</label>
              <input className={INPUT} value={assetForm.vendor} placeholder="Cisco" onChange={(e) => setAssetForm((f) => ({ ...f, vendor: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Modelo</label>
              <input className={INPUT} value={assetForm.model} placeholder="CBS350" onChange={(e) => setAssetForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Hostname</label>
            <input className={INPUT} value={assetForm.hostname} placeholder="cmc-core-sw-01" onChange={(e) => setAssetForm((f) => ({ ...f, hostname: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Notas</label>
            <textarea className={`${INPUT} min-h-24 resize-y`} value={assetForm.notes} placeholder="Rack principal del centro de mando." onChange={(e) => setAssetForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeAssetModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">
              Cancelar
            </button>
            <button type="submit" disabled={savingAsset} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {savingAsset ? "Guardando…" : editingAsset ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
