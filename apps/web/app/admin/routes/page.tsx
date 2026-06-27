"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type RouteItem = {
  id: string; identifier: string; type: string; state: string;
  center: { id: string; name: string };
  _count: { nodes: number };
};
type CenterRef = { id: string; name: string };
type CreateForm = { identifier: string; type: string; monitoringCenterId: string };
type EditForm = { identifier: string; type: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const ROUTE_TYPES = ["FIBER", "WIRELESS", "HYBRID"];

export default function RoutesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<RouteItem[]>([]);
  const [centers, setCenters] = useState<CenterRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RouteItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ identifier: "", type: "FIBER", monitoringCenterId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ identifier: "", type: "FIBER", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        apiGet<RouteItem[]>("/routes", accessToken),
        apiGet<CenterRef[]>("/monitoring-centers", accessToken),
      ]);
      setItems(r); setCenters(c);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ identifier: "", type: "FIBER", monitoringCenterId: centers[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: RouteItem) {
    setEditing(item);
    setEditForm({ identifier: item.identifier, type: item.type, state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) { await apiPatch(`/routes/${editing.id}`, accessToken, editForm); }
      else { await apiPost("/routes", accessToken, createForm); }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Rutas">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} rutas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nueva ruta</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Identificador</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">CMC</th>
                <th className="px-4 py-3">Nodos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-mono text-sm text-ops-text">{item.identifier}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.type}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.center.name}</td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.nodes}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>{item.state}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsModal open={modalOpen} title={editing ? "Editar ruta" : "Nueva ruta"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Identificador</label>
            <input className={INPUT} value={editing ? editForm.identifier : createForm.identifier}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, identifier: e.target.value })) : setCreateForm((f) => ({ ...f, identifier: e.target.value }))}
              required placeholder="RUTA-001" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
            <select className={INPUT} value={editing ? editForm.type : createForm.type}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, type: e.target.value })) : setCreateForm((f) => ({ ...f, type: e.target.value }))}>
              {ROUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">CMC</label>
              <select className={INPUT} value={createForm.monitoringCenterId} onChange={(e) => setCreateForm((f) => ({ ...f, monitoringCenterId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
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
