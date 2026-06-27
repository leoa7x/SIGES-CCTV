"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CameraItem = {
  id: string; code: string; name: string; ip: string | null;
  brand: string | null; model: string | null; state: string; hasAnalytics: boolean;
  node: { id: string; code: string; name: string };
};
type NodeRef = { id: string; code: string; name: string };
type CreateForm = { code: string; name: string; ip: string; brand: string; model: string; resolution: string; hasAnalytics: boolean; nodeId: string };
type EditForm = { name: string; ip: string; hasAnalytics: boolean; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const CAM_STATES = ["ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"];
const STATE_COLOR: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

export default function CamerasPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CameraItem[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CameraItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ code: "", name: "", ip: "", brand: "", model: "", resolution: "", hasAnalytics: false, nodeId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", ip: "", hasAnalytics: false, state: "ONLINE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [c, n] = await Promise.all([
        apiGet<CameraItem[]>("/cameras", accessToken),
        apiGet<NodeRef[]>("/nodes", accessToken),
      ]);
      setItems(c); setNodes(n);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ code: "", name: "", ip: "", brand: "", model: "", resolution: "", hasAnalytics: false, nodeId: nodes[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: CameraItem) {
    setEditing(item);
    setEditForm({ name: item.name, ip: item.ip ?? "", hasAnalytics: item.hasAnalytics, state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/cameras/${editing.id}`, accessToken, {
          name: editForm.name, ip: editForm.ip || undefined,
          hasAnalytics: editForm.hasAnalytics, state: editForm.state,
        });
      } else {
        await apiPost("/cameras", accessToken, {
          code: createForm.code, name: createForm.name,
          ip: createForm.ip || undefined, brand: createForm.brand || undefined,
          model: createForm.model || undefined, resolution: createForm.resolution || undefined,
          hasAnalytics: createForm.hasAnalytics, nodeId: createForm.nodeId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Cámaras">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} cámaras</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nueva cámara</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Nodo</th>
                <th className="px-4 py-3 hidden md:table-cell">IP</th>
                <th className="px-4 py-3 hidden md:table-cell">Analítica</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[item.state] ?? STATE_COLOR.MAINTENANCE}`}>{item.state}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-text">{item.code}</td>
                  <td className="px-4 py-3 text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[11px] text-ops-muted">{item.node.code}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-ops-dim">{item.ip ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ops-muted">{item.hasAnalytics ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsModal open={modalOpen} title={editing ? `Editar ${editing.code}` : "Nueva cámara"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código (único)</label>
              <input className={INPUT} value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} required placeholder="CAM-001" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="Cámara Esquina Norte" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP (opcional)</label>
            <input className={INPUT} value={editing ? editForm.ip : createForm.ip}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, ip: e.target.value })) : setCreateForm((f) => ({ ...f, ip: e.target.value }))}
              placeholder="192.168.1.20" />
          </div>
          {!editing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Marca</label>
                  <input className={INPUT} value={createForm.brand} onChange={(e) => setCreateForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Dahua" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Modelo</label>
                  <input className={INPUT} value={createForm.model} onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))} placeholder="IPC-HDW2831T" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nodo</label>
                <select className={INPUT} value={createForm.nodeId} onChange={(e) => setCreateForm((f) => ({ ...f, nodeId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name}</option>)}
                </select>
              </div>
            </>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                {CAM_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ops-muted">
            <input type="checkbox" checked={editing ? editForm.hasAnalytics : createForm.hasAnalytics}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, hasAnalytics: e.target.checked })) : setCreateForm((f) => ({ ...f, hasAnalytics: e.target.checked }))}
              className="rounded" />
            Tiene analítica de video
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
