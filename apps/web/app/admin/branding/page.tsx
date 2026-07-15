"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OpsModal } from "../../../components/ops-modal";
import { OpsShell } from "../../../components/ops-shell";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost, apiPostFile } from "../../../lib/api";
import { formatLifecycleState } from "../../../lib/presentation";

type CityRef = {
  id: string;
  name: string;
  type: "MUNICIPALITY" | "DEPARTMENT";
  department: string | null;
};

type BrandingProfile = {
  id: string;
  name: string;
  logoUrl: string | null;
  loginMessage: string | null;
  isActive: boolean;
  city: CityRef;
};

type FormState = {
  name: string;
  cityId: string;
  loginMessage: string;
  isActive: boolean;
};

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function BrandingPage() {
  const { accessToken } = useAuth();
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [cities, setCities] = useState<CityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BrandingProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", cityId: "", loginMessage: "", isActive: false });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [branding, cityItems] = await Promise.all([
        apiGet<BrandingProfile[]>("/branding-profiles", accessToken),
        apiGet<CityRef[]>("/cities", accessToken),
      ]);
      setProfiles(branding);
      setCities(cityItems);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setLogoFile(null);
    setLogoPreview(null);
    setForm({
      name: "",
      cityId: cities[0]?.id ?? "",
      loginMessage: "",
      isActive: profiles.length === 0,
    });
    setModalOpen(true);
  }

  function openEdit(profile: BrandingProfile) {
    setEditing(profile);
    setLogoFile(null);
    setLogoPreview(profile.logoUrl);
    setForm({
      name: profile.name,
      cityId: profile.city.id,
      loginMessage: profile.loginMessage ?? "",
      isActive: profile.isActive,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (!file) {
      setLogoPreview(editing?.logoUrl ?? null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setLogoPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      let profileId = editing?.id;
      if (editing) {
        await apiPatch(`/branding-profiles/${editing.id}`, accessToken, form);
      } else {
        const created = await apiPost<{ id: string }>("/branding-profiles", accessToken, form);
        profileId = created.id;
      }

      if (logoFile && profileId) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await apiPostFile(`/branding-profiles/${profileId}/logo`, accessToken, fd);
      }

      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <OpsShell eyebrow="Administración" title="Branding de Login">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{profiles.length} perfiles configurados</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo perfil
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
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Texto login</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    {profile.logoUrl ? (
                      <img src={profile.logoUrl} alt={profile.name} className="h-10 w-10 rounded object-contain" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded border border-ops-border bg-ops-surface px-1 text-center text-[9px] text-ops-dim">Sin logo</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-ops-text">{profile.name}</td>
                  <td className="px-4 py-3 text-ops-muted">
                    <p>{profile.city.name}</p>
                    <p className="text-[10px]">{profile.city.type === "DEPARTMENT" ? "Departamento" : profile.city.department ?? "Municipio"}</p>
                  </td>
                  <td className="px-4 py-3 text-ops-muted">{profile.loginMessage ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${profile.isActive ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {formatLifecycleState(profile.isActive ? "ACTIVE" : "INACTIVE")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(profile)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar perfil de branding" : "Nuevo perfil de branding"} onClose={closeModal} saving={saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre interno</label>
            <input className={INPUT} value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} required placeholder="Branding Gobernación Meta" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ciudad / Departamento de referencia</label>
            <select className={INPUT} value={form.cityId} onChange={(e) => setForm((current) => ({ ...current, cityId: e.target.value }))} required>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} · {city.type === "DEPARTMENT" ? "Departamento" : city.department ?? "Municipio"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Texto debajo del logo</label>
            <textarea className={INPUT} rows={3} value={form.loginMessage} onChange={(e) => setForm((current) => ({ ...current, loginMessage: e.target.value }))} placeholder="Centro de monitoreo departamental" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Logo del login</label>
            <div className="flex items-center gap-3">
              {logoPreview && <img src={logoPreview} alt="Preview branding" className="h-14 w-14 rounded border border-ops-border object-contain" />}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-ops border border-ops-border px-3 py-1.5 text-[11px] text-ops-muted hover:border-ops-blue hover:text-ops-blue">
                {logoPreview ? "Cambiar imagen" : "Seleccionar imagen"}
              </button>
              {logoFile && <span className="max-w-40 truncate text-[10px] text-ops-dim">{logoFile.name}</span>}
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} />
            Activar este perfil para el login
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
