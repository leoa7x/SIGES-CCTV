"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CenterItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  lat: number | null;
  lng: number | null;
  state: string;
  project: { id: string; name: string; city: { name: string } };
  _count: { routes: number };
};
type ProjectRef = { id: string; name: string };
type CreateForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; projectId: string;
};
type EditForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; state: string;
};

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const EMPTY_CREATE: CreateForm = {
  name: "", address: "", phone: "", contactName: "", lat: "", lng: "", projectId: "",
};

export default function CentersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CenterItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CenterItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", address: "", phone: "", contactName: "", lat: "", lng: "", state: "ACTIVE",
  });
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
    setCreateForm({ ...EMPTY_CREATE, projectId: projects[0]?.id ?? "" });
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
      state: item.state,
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }

  function parseOptionalNumber(s: string): number | undefined {
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
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
          projectId: createForm.projectId,
        });
      }
      closeModal();
      await load();
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
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
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

          {/* State (edit only) */}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state}
                onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
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
    </OpsShell>
  );
}
