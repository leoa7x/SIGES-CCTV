"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsModal } from "../../components/ops-modal";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../lib/api";

type Project = {
  id: string; name: string; client: string; contract: string | null;
  state: string; startDate: string;
  city: { id: string; name: string; department: string };
  _count: { centers: number };
};
type CityRef = { id: string; name: string; department: string };
type CreateForm = { name: string; client: string; contract: string; startDate: string; cityId: string };
type EditForm = { name: string; client: string; contract: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const STATE_COLOR: Record<string, string> = {
  ACTIVE:   "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  INACTIVE: "text-ops-muted border-ops-dim bg-ops-surface",
  ARCHIVED: "text-ops-dim border-ops-dim bg-ops-surface",
};

export default function ProjectsPage() {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cities, setCities] = useState<CityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", client: "", contract: "", startDate: "", cityId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", client: "", contract: "", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiGet<Project[]>("/projects", accessToken),
        apiGet<CityRef[]>("/cities", accessToken),
      ]);
      setProjects(p);
      setCities(c);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ name: "", client: "", contract: "", startDate: "", cityId: cities[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setEditForm({ name: p.name, client: p.client, contract: p.contract ?? "", state: p.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/projects/${editing.id}`, accessToken, {
          name: editForm.name, client: editForm.client,
          contract: editForm.contract || undefined, state: editForm.state,
        });
      } else {
        await apiPost("/projects", accessToken, {
          name: createForm.name, client: createForm.client,
          contract: createForm.contract || undefined,
          startDate: new Date(createForm.startDate).toISOString(),
          cityId: createForm.cityId,
        });
      }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Estructura" title="Proyectos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{projects.length} proyectos</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo proyecto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-ops border border-ops-border bg-ops-panel py-16 text-center text-sm text-ops-muted">
          No hay proyectos. Crea el primero.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops transition hover:border-ops-blue/30">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${STATE_COLOR[p.state] ?? ""}`}>
                  {p.state}
                </span>
                <p className="text-right text-[10px] text-ops-dim">
                  {new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(new Date(p.startDate))}
                </p>
              </div>
              <h3 className="text-sm font-semibold text-ops-text">{p.name}</h3>
              <p className="mt-0.5 text-[11px] text-ops-muted">{p.client}</p>
              {p.contract && <p className="mt-0.5 font-mono text-[10px] text-ops-dim">{p.contract}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-ops-border pt-3">
                <p className="text-[11px] text-ops-muted">{p.city.name}, {p.city.department}</p>
                <button onClick={() => openEdit(p)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar proyecto" : "Nuevo proyecto"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Sistema CCTV Puerto Gaitán" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Cliente</label>
                <input className={INPUT} value={createForm.client} onChange={(e) => setCreateForm((f) => ({ ...f, client: e.target.value }))} required placeholder="Alcaldía de Puerto Gaitán" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contrato (opcional)</label>
                <input className={INPUT} value={createForm.contract} onChange={(e) => setCreateForm((f) => ({ ...f, contract: e.target.value }))} placeholder="1445-2024" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Fecha inicio</label>
                <input type="date" className={INPUT} value={createForm.startDate} onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ciudad</label>
                <select className={INPUT} value={createForm.cityId} onChange={(e) => setCreateForm((f) => ({ ...f, cityId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.department}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Cliente</label>
                <input className={INPUT} value={editForm.client} onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contrato</label>
                <input className={INPUT} value={editForm.contract} onChange={(e) => setEditForm((f) => ({ ...f, contract: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
                <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </>
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
