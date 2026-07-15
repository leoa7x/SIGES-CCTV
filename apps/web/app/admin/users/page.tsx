"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNotice } from "../../../components/ops-notice";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";
import { formatLifecycleState, formatRoleLabel, toUserFacingError } from "../../../lib/presentation";
import {
  ALL_PERMISSIONS,
  normalizePermissionsForRole,
  PERMISSION_LABELS,
  shouldRoleUseGranularPermissions,
  type UserPermission,
} from "../../../lib/user-permissions";

type UserItem = { id: string; email: string; name: string | null; role: string; state: string; permissions: UserPermission[]; createdAt: string };
type CreateForm = { email: string; password: string; name: string; role: string; permissions: UserPermission[] };
type EditForm = { name: string; role: string; state: string; permissions: UserPermission[] };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const ROLES = ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "OPERATOR", "TECHNICIAN", "VIEWER"];

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  ADMIN:       "border-ops-blue/30 bg-ops-blue/10 text-ops-blue",
  SUPERVISOR:  "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OPERATOR:    "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  TECHNICIAN:  "border-ops-border bg-ops-surface text-ops-muted",
  VIEWER:      "border-ops-border bg-ops-surface text-ops-dim",
};

export default function UsersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ email: "", password: "", name: "", role: "OPERATOR", permissions: [] });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", role: "OPERATOR", state: "ACTIVE", permissions: [] });
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMessage("");
    try { setItems(await apiGet<UserItem[]>("/users", accessToken)); }
    catch (err) { setErrorMessage(toUserFacingError(err, "No se pudieron cargar los usuarios.")); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ email: "", password: "", name: "", role: "OPERATOR", permissions: [] });
    setModalOpen(true);
  }
  function openEdit(item: UserItem) {
    setEditing(item);
    setEditForm({ name: item.name ?? "", role: item.role, state: item.state, permissions: item.permissions ?? [] });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  function togglePermission(permission: UserPermission) {
    if (editing) {
      setEditForm((form) => ({
        ...form,
        permissions: form.permissions.includes(permission)
          ? form.permissions.filter((value) => value !== permission)
          : [...form.permissions, permission],
      }));
      return;
    }

    setCreateForm((form) => ({
      ...form,
      permissions: form.permissions.includes(permission)
        ? form.permissions.filter((value) => value !== permission)
        : [...form.permissions, permission],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setErrorMessage("");
    try {
      if (editing) {
        await apiPatch(`/users/${editing.id}`, accessToken, {
          name: editForm.name || undefined,
          role: editForm.role,
          state: editForm.state,
          permissions: normalizePermissionsForRole(editForm.role, editForm.permissions),
        });
      } else {
        await apiPost("/users", accessToken, {
          email: createForm.email, password: createForm.password,
          name: createForm.name || undefined,
          role: createForm.role,
          permissions: normalizePermissionsForRole(createForm.role, createForm.permissions),
        });
      }
      closeModal(); await load();
    } catch (err) {
      setErrorMessage(toUserFacingError(err, "No se pudo guardar el usuario."));
    } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Usuarios">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} usuarios</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nuevo usuario</button>
      </div>
      {errorMessage ? (
        <div className="mb-4">
          <OpsNotice tone="error" title="No se pudo completar la acción" message={errorMessage} onDismiss={() => setErrorMessage("")} />
        </div>
      ) : null}
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Permisos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-medium text-ops-text">{item.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${ROLE_COLOR[item.role] ?? ""}`}>{formatRoleLabel(item.role)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ops-muted">
                    {shouldRoleUseGranularPermissions(item.role)
                      ? item.permissions.length > 0
                        ? `${item.permissions.length} asignados`
                        : "Sin asignar"
                      : "Acceso total"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>{formatLifecycleState(item.state)}</span>
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
      <OpsModal open={modalOpen} title={editing ? "Editar usuario" : "Nuevo usuario"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Email</label>
                <input type="email" className={INPUT} value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required placeholder="operador@municipio.gov.co" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contraseña (mín. 8 caracteres)</label>
                <input type="password" className={INPUT} value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre (opcional)</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Juan Pérez" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Rol</label>
            <select className={INPUT} value={editing ? editForm.role : createForm.role}
              onChange={(e) => editing
                ? setEditForm((f) => ({ ...f, role: e.target.value, permissions: normalizePermissionsForRole(e.target.value, f.permissions) }))
                : setCreateForm((f) => ({ ...f, role: e.target.value, permissions: normalizePermissionsForRole(e.target.value, f.permissions) }))}>
              {ROLES.map((r) => <option key={r} value={r}>{formatRoleLabel(r)}</option>)}
            </select>
          </div>
          {shouldRoleUseGranularPermissions(editing ? editForm.role : createForm.role) ? (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Permisos granulares</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_PERMISSIONS.map((permission) => {
                  const selected = editing
                    ? editForm.permissions.includes(permission)
                    : createForm.permissions.includes(permission);
                  return (
                    <label key={permission} className={`flex items-start gap-2 rounded-ops border px-3 py-2 text-sm ${selected ? "border-ops-blue bg-ops-blue/10 text-ops-text" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected}
                        onChange={() => togglePermission(permission)}
                      />
                      <span>{PERMISSION_LABELS[permission]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-xs text-ops-muted">
              Este rol conserva acceso total por diseño. Los permisos granulares solo aplican a los demás roles.
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">{formatLifecycleState("ACTIVE")}</option>
                <option value="INACTIVE">{formatLifecycleState("INACTIVE")}</option>
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
