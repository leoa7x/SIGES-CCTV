"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type Counts = { cameras: number; nodes: number; poles: number };
type CityItem = {
  id: string; name: string; type: "MUNICIPALITY" | "DEPARTMENT";
  department: string | null; daneCode: string | null;
  population: number | null; areaSqKm: number | null;
  contractObject: string | null;
  lat: number | null; lng: number | null; state: string;
  counts: Counts;
};
type CreateForm = {
  name: string; type: "MUNICIPALITY" | "DEPARTMENT"; department: string;
  daneCode: string; population: string; areaSqKm: string;
  contractObject: string; lat: string; lng: string;
};
type EditForm = {
  name: string; type: "MUNICIPALITY" | "DEPARTMENT"; department: string;
  daneCode: string; population: string; areaSqKm: string;
  contractObject: string; lat: string; lng: string; state: string;
};
const EMPTY_CREATE: CreateForm = {
  name: "", type: "MUNICIPALITY", department: "", daneCode: "",
  population: "", areaSqKm: "", contractObject: "", lat: "", lng: "",
};
const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function CitiesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", type: "MUNICIPALITY", department: "", daneCode: "",
    population: "", areaSqKm: "", contractObject: "", lat: "", lng: "", state: "ACTIVE",
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try { setItems(await apiGet<CityItem[]>("/cities", accessToken)); }
    catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm(EMPTY_CREATE);
    setModalOpen(true);
  }

  function openEdit(item: CityItem) {
    setEditing(item);
    setEditForm({
      name: item.name, type: item.type,
      department: item.department ?? "", daneCode: item.daneCode ?? "",
      population: item.population != null ? String(item.population) : "",
      areaSqKm: item.areaSqKm != null ? String(item.areaSqKm) : "",
      contractObject: item.contractObject ?? "",
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
  function parseOptionalInt(s: string): number | undefined {
    const n = parseInt(s, 10);
    return isNaN(n) ? undefined : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        const payload = {
          name: editForm.name, type: editForm.type,
          department: editForm.department || undefined,
          daneCode: editForm.daneCode || undefined,
          population: parseOptionalInt(editForm.population),
          areaSqKm: parseOptionalNumber(editForm.areaSqKm),
          contractObject: editForm.contractObject || undefined,
          lat: parseOptionalNumber(editForm.lat),
          lng: parseOptionalNumber(editForm.lng),
          state: editForm.state,
        };
        await apiPatch(`/cities/${editing.id}`, accessToken, payload);
      } else {
        const payload = {
          name: createForm.name, type: createForm.type,
          department: createForm.department || undefined,
          daneCode: createForm.daneCode || undefined,
          population: parseOptionalInt(createForm.population),
          areaSqKm: parseOptionalNumber(createForm.areaSqKm),
          contractObject: createForm.contractObject || undefined,
          lat: parseOptionalNumber(createForm.lat),
          lng: parseOptionalNumber(createForm.lng),
        };
        await apiPost<{ id: string }>("/cities", accessToken, payload);
      }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  const form = editing ? editForm : createForm;
  const setForm = editing
    ? (fn: (f: EditForm) => EditForm) => setEditForm(fn)
    : (fn: (f: CreateForm) => CreateForm) => setCreateForm(fn as any);

  return (
    <OpsShell eyebrow="Administración" title="Ciudades y Departamentos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} entidades geográficas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nueva ciudad
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
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 hidden sm:table-cell">DANE</th>
                <th className="px-4 py-3 hidden md:table-cell">Cámaras</th>
                <th className="px-4 py-3 hidden md:table-cell">Nodos</th>
                <th className="px-4 py-3 hidden md:table-cell">Postes</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ops-text">{item.name}</p>
                    {item.department && <p className="text-[10px] text-ops-muted">{item.department}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${item.type === "DEPARTMENT" ? "border-ops-amber/30 bg-ops-amber/10 text-ops-amber" : "border-ops-blue/30 bg-ops-blue/10 text-ops-blue"}`}>
                      {item.type === "DEPARTMENT" ? "DPTO" : "MUN"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-ops-muted">{item.daneCode ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts?.cameras ?? 0}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts?.nodes ?? 0}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts?.poles ?? 0}</td>
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

      <OpsModal open={modalOpen} title={editing ? "Editar entidad" : "Nueva entidad geográfica"} onClose={closeModal} saving={saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
            <div className="flex gap-2">
              {(["MUNICIPALITY", "DEPARTMENT"] as const).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => editing
                    ? setEditForm((f) => ({ ...f, type: t, department: t === "DEPARTMENT" ? "" : f.department }))
                    : setCreateForm((f) => ({ ...f, type: t, department: t === "DEPARTMENT" ? "" : f.department }))
                  }
                  className={`flex-1 rounded-ops border py-2 text-[11px] font-semibold transition ${
                    form.type === t
                      ? "border-ops-blue bg-ops-blue/10 text-ops-blue"
                      : "border-ops-border text-ops-muted hover:border-ops-blue/40"
                  }`}
                >
                  {t === "MUNICIPALITY" ? "Municipio" : "Departamento"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              {form.type === "DEPARTMENT" ? "Nombre del departamento" : "Nombre del municipio"}
            </label>
            <input className={INPUT} value={form.name} required
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.type === "DEPARTMENT" ? "Meta" : "Puerto Gaitán"} />
          </div>

          {/* Department (only for MUNICIPALITY) */}
          {form.type === "MUNICIPALITY" && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Departamento</label>
              <input className={INPUT} value={form.department}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, department: e.target.value })) : setCreateForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Meta" />
            </div>
          )}

          {/* DANE + Population + Area */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código DANE</label>
              <input className={INPUT} value={form.daneCode}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, daneCode: e.target.value })) : setCreateForm((f) => ({ ...f, daneCode: e.target.value }))}
                placeholder={form.type === "DEPARTMENT" ? "50" : "50686"} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Población</label>
              <input type="number" className={INPUT} value={form.population}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, population: e.target.value })) : setCreateForm((f) => ({ ...f, population: e.target.value }))}
                placeholder="18000" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Área km²</label>
              <input type="number" step="0.01" className={INPUT} value={form.areaSqKm}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, areaSqKm: e.target.value })) : setCreateForm((f) => ({ ...f, areaSqKm: e.target.value }))}
                placeholder="17499" />
            </div>
          </div>

          {/* Contract object */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Objeto del contrato</label>
            <textarea className={INPUT} rows={2} value={form.contractObject}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, contractObject: e.target.value })) : setCreateForm((f) => ({ ...f, contractObject: e.target.value }))}
              placeholder="Instalación y mantenimiento de sistema de videovigilancia…" />
          </div>

          {/* GIS coordinates */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              Coordenadas GIS <span className="font-normal text-ops-dim">(auto-geocodificadas al guardar si se dejan vacías)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className={INPUT} value={form.lat} placeholder="Latitud (ej. 4.0756)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lat: e.target.value })) : setCreateForm((f) => ({ ...f, lat: e.target.value }))} />
              <input className={INPUT} value={form.lng} placeholder="Longitud (ej. -72.0836)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lng: e.target.value })) : setCreateForm((f) => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>

          {/* State (edit only) */}
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
