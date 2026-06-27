"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type NodeItem = {
  id: string; code: string; name: string; ip: string | null;
  nodeType: string; operativeState: string;
  route: { id: string; identifier: string; center: { name: string } };
};
type RouteRef = { id: string; identifier: string; center: { name: string } };
type CreateForm = { code: string; name: string; ip: string; mac: string; nodeType: string; snmpCommunity: string; routeId: string };
type EditForm = { name: string; ip: string; mac: string; nodeType: string; snmpCommunity: string; operativeState: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const NODE_TYPES = ["SWITCH", "CABINET", "AMPLIFIER", "SPLITTER", "OTHER"];
const NODE_STATES = ["ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"];

const STATE_COLOR: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

export default function NodesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<NodeItem[]>([]);
  const [routes, setRoutes] = useState<RouteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NodeItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ code: "", name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", routeId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", operativeState: "ONLINE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [n, r] = await Promise.all([
        apiGet<NodeItem[]>("/nodes", accessToken),
        apiGet<RouteRef[]>("/routes", accessToken),
      ]);
      setItems(n); setRoutes(r);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ code: "", name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", routeId: routes[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: NodeItem) {
    setEditing(item);
    setEditForm({ name: item.name, ip: item.ip ?? "", mac: "", nodeType: item.nodeType, snmpCommunity: "", operativeState: item.operativeState });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/nodes/${editing.id}`, accessToken, {
          name: editForm.name, ip: editForm.ip || undefined,
          mac: editForm.mac || undefined, nodeType: editForm.nodeType,
          snmpCommunity: editForm.snmpCommunity || undefined,
          operativeState: editForm.operativeState,
        });
      } else {
        await apiPost("/nodes", accessToken, {
          code: createForm.code, name: createForm.name, lat: 0, lng: 0,
          ip: createForm.ip || undefined, mac: createForm.mac || undefined,
          nodeType: createForm.nodeType,
          snmpCommunity: createForm.snmpCommunity || undefined,
          routeId: createForm.routeId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Nodos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} nodos · Las coordenadas se asignan en la página Mapa</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nuevo nodo</button>
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
                <th className="px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="px-4 py-3 hidden md:table-cell">IP</th>
                <th className="px-4 py-3 hidden md:table-cell">Ruta / CMC</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[item.operativeState] ?? STATE_COLOR.MAINTENANCE}`}>
                      {item.operativeState}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-text">{item.code}</td>
                  <td className="px-4 py-3 text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ops-muted">{item.nodeType}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-ops-dim">{item.ip ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-[11px] text-ops-muted">{item.route.identifier} · {item.route.center.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsModal open={modalOpen} title={editing ? `Editar ${editing.code}` : "Nuevo nodo"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código (único)</label>
              <input className={INPUT} value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} required placeholder="NODE-001" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="Cámara Parque Central" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
              <select className={INPUT} value={editing ? editForm.nodeType : createForm.nodeType}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, nodeType: e.target.value })) : setCreateForm((f) => ({ ...f, nodeType: e.target.value }))}>
                {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP (opcional)</label>
              <input className={INPUT} value={editing ? editForm.ip : createForm.ip}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, ip: e.target.value })) : setCreateForm((f) => ({ ...f, ip: e.target.value }))}
                placeholder="192.168.1.10" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">SNMP Community (opcional)</label>
            <input className={INPUT} value={editing ? editForm.snmpCommunity : createForm.snmpCommunity}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, snmpCommunity: e.target.value })) : setCreateForm((f) => ({ ...f, snmpCommunity: e.target.value }))}
              placeholder="public" />
          </div>
          {!editing ? (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta</label>
              <select className={INPUT} value={createForm.routeId} onChange={(e) => setCreateForm((f) => ({ ...f, routeId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.identifier} — {r.center.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado operativo</label>
              <select className={INPUT} value={editForm.operativeState} onChange={(e) => setEditForm((f) => ({ ...f, operativeState: e.target.value }))}>
                {NODE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <p className="text-[10px] text-ops-dim">Las coordenadas (lat/lng) se asignan desde la página Mapa → botón Ubicar.</p>
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
