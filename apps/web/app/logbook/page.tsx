"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsModal } from "../../components/ops-modal";
import { OpsNotice } from "../../components/ops-notice";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPost } from "../../lib/api";
import { toUserFacingError } from "../../lib/presentation";

type Entry = {
  id: string; date: string; activityType: string; observations: string | null; result: string;
  technician: { name: string | null; email: string };
  node: { code: string; name: string };
};
type NodeRef = { id: string; code: string; name: string };
type UserRef = { id: string; name: string | null; email: string };
type CreateForm = { activityType: string; observations: string; result: string; technicianId: string; nodeId: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const RESULT_COLOR: Record<string, string> = {
  SATISFACTORY: "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  PARTIAL:      "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  FAILED:       "text-ops-rose border-ops-rose/30 bg-ops-rose/10",
  PENDING:      "text-ops-muted border-ops-dim bg-ops-surface",
};

const ACTIVITY_LABELS: Record<string, string> = {
  PREVENTIVE_MAINTENANCE: "Mant. Preventivo",
  CORRECTIVE_MAINTENANCE: "Mant. Correctivo",
  INSPECTION: "Inspección",
  INSTALLATION: "Instalación",
  CONFIGURATION: "Configuración",
  OTHER: "Otro",
};

export default function LogbookPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>({ activityType: "INSPECTION", observations: "", result: "SATISFACTORY", technicianId: "", nodeId: "" });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setLoadError("");
    try {
      const [e, n, u] = await Promise.all([
        apiGet<Entry[]>("/logbook", accessToken),
        apiGet<NodeRef[]>("/nodes", accessToken),
        apiGet<UserRef[]>("/users/technicians", accessToken),
      ]);
      setEntries(e); setNodes(n); setUsers(u);
    } catch (err) {
      setLoadError(toUserFacingError(err, "No se pudo cargar la bitácora."));
    } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ activityType: "INSPECTION", observations: "", result: "SATISFACTORY", technicianId: users[0]?.id ?? "", nodeId: nodes[0]?.id ?? "" });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      await apiPost("/logbook", accessToken, { ...form, observations: form.observations || undefined });
      setModalOpen(false);
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Operaciones" title="Bitácora">
      {loadError ? (
        <div className="mb-4">
          <OpsNotice tone="error" title="No se pudo cargar la información" message={loadError} onDismiss={() => setLoadError("")} />
        </div>
      ) : null}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{entries.length} entradas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nueva entrada
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : entries.length === 0 ? (
        <div className="rounded-ops border border-ops-border bg-ops-panel py-16 text-center text-sm text-ops-muted">No hay entradas en la bitácora.</div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Actividad</th>
                <th className="px-4 py-3">Nodo</th>
                <th className="px-4 py-3 hidden sm:table-cell">Técnico</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 text-[11px] text-ops-muted">
                    {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.date))}
                  </td>
                  <td className="px-4 py-3 text-ops-text">{ACTIVITY_LABELS[entry.activityType] ?? entry.activityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-muted">{entry.node.code}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[11px] text-ops-muted">{entry.technician.name ?? entry.technician.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${RESULT_COLOR[entry.result] ?? ""}`}>{entry.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title="Nueva entrada de bitácora" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo de actividad</label>
            <select className={INPUT} value={form.activityType} onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}>
              {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Resultado</label>
            <select className={INPUT} value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}>
              {["SATISFACTORY", "PARTIAL", "FAILED", "PENDING"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nodo</label>
            <select className={INPUT} value={form.nodeId} onChange={(e) => setForm((f) => ({ ...f, nodeId: e.target.value }))} required>
              <option value="">Seleccionar…</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Técnico</label>
            <select className={INPUT} value={form.technicianId} onChange={(e) => setForm((f) => ({ ...f, technicianId: e.target.value }))} required>
              <option value="">Seleccionar…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Observaciones (opcional)</label>
            <textarea className={INPUT} rows={3} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} placeholder="Descripción del trabajo realizado…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
