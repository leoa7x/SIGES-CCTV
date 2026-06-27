"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CenterItem = {
  id: string; name: string; address: string | null; state: string;
  project: { id: string; name: string; city: { name: string } };
  _count: { routes: number };
};
type ProjectRef = { id: string; name: string };
type CreateForm = { name: string; address: string; projectId: string };
type EditForm = { name: string; address: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function CentersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CenterItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CenterItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", address: "", projectId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", address: "", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        apiGet<CenterItem[]>("/monitoring-centers", accessToken),
        apiGet<ProjectRef[]>("/projects", accessToken),
      ]);
      setItems(c); setProjects(p);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ name: "", address: "", projectId: projects[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: CenterItem) {
    setEditing(item);
    setEditForm({ name: item.name, address: item.address ?? "", state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/monitoring-centers/${editing.id}`, accessToken, {
          name: editForm.name, address: editForm.address || undefined, state: editForm.state,
        });
      } else {
        await apiPost("/monitoring-centers", accessToken, {
          name: createForm.name, address: createForm.address || undefined, projectId: createForm.projectId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Centros de Monitoreo (CMC)">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} centros</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo CMC
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Proyecto / Ciudad</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-medium text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.project.name} · {item.project.city.name}</td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.routes}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {item.state}
                    </span>
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
      <OpsModal open={modalOpen} title={editing ? "Editar CMC" : "Nuevo CMC"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="CMC Central" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Dirección (opcional)</label>
            <input className={INPUT} value={editing ? editForm.address : createForm.address}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, address: e.target.value })) : setCreateForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Calle 1 # 2-3" />
          </div>
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Proyecto</label>
              <select className={INPUT} value={createForm.projectId} onChange={(e) => setCreateForm((f) => ({ ...f, projectId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
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
