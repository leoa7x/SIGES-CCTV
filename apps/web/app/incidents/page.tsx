"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../lib/api";

type Incident = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  detectedAt: string;
  resolvedAt: string | null;
  node?: { code: string; name: string } | null;
  camera?: { code: string; name: string } | null;
  assignedUser?: { name: string | null; email: string } | null;
};

const severityColors: Record<string, string> = {
  CRITICAL: "text-ops-rose border-ops-rose/40 bg-ops-rose/10",
  HIGH:     "text-orange-400 border-orange-500/30 bg-orange-500/10",
  MEDIUM:   "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  LOW:      "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
};

const statusColors: Record<string, string> = {
  NEW:           "text-sky-400 border-sky-400/30 bg-sky-400/10",
  IN_PROGRESS:   "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  PENDING_PARTS: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  RESOLVED:      "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  CLOSED:        "text-ops-muted border-ops-dim bg-ops-surface",
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo", IN_PROGRESS: "En curso", PENDING_PARTS: "Pend. partes", RESOLVED: "Resuelto", CLOSED: "Cerrado",
};

const SEV_LABELS: Record<string, string> = {
  CRITICAL: "Crítico", HIGH: "Alto", MEDIUM: "Medio", LOW: "Bajo",
};

function fmt(v: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(v));
}

export default function IncidentsPage() {
  const { accessToken } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!accessToken) return;
    apiGet<Incident[]>("/incidents", accessToken)
      .then((data) => { setIncidents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [accessToken]);

  const filtered = incidents.filter((i) => {
    const q = filter.toLowerCase();
    const matchSearch = !q || i.title.toLowerCase().includes(q) || (i.node?.name ?? "").toLowerCase().includes(q) || (i.node?.code ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleStatusChange() {
    if (!selected || !newStatus || !accessToken) return;
    setSaving(true);
    try {
      await apiPatch(`/incidents/${selected.id}`, accessToken, { status: newStatus });
      load();
      setSelected(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <OpsShell eyebrow="Operaciones" title="Gestión de Incidentes">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            className="rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text placeholder-ops-dim outline-none transition focus:border-ops-cyan sm:w-72"
            placeholder="Buscar por título, nodo…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className="rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text outline-none transition focus:border-ops-cyan"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-ops border border-ops-border bg-ops-panel">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-ops-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-cyan" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-ops-muted">No hay incidentes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ops-border text-left">
                    {["Severidad", "Título", "Nodo", "Estado", "Detectado", "Asignado a"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-ops-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inc) => (
                    <tr
                      key={inc.id}
                      className="cursor-pointer border-b border-ops-border/50 transition hover:bg-ops-surface"
                      onClick={() => { setSelected(inc); setNewStatus(inc.status); }}
                    >
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${severityColors[inc.severity] ?? ""}`}>
                          {SEV_LABELS[inc.severity] ?? inc.severity}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-ops-text">{inc.title}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ops-muted">{inc.node?.code ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${statusColors[inc.status] ?? ""}`}>
                          {STATUS_LABELS[inc.status] ?? inc.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ops-dim">{fmt(inc.detectedAt)}</td>
                      <td className="px-4 py-3 text-ops-muted">{inc.assignedUser?.name ?? inc.assignedUser?.email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ops-bg/80 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-ops-xl border border-ops-border bg-ops-panel p-6 shadow-ops" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${severityColors[selected.severity] ?? ""}`}>
                  {SEV_LABELS[selected.severity] ?? selected.severity}
                </span>
                <h2 className="mt-2 text-base font-semibold text-ops-text">{selected.title}</h2>
                {selected.description && <p className="mt-1 text-sm text-ops-muted">{selected.description}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-ops-muted hover:text-ops-text">✕</button>
            </div>

            <div className="mb-4 space-y-1.5 text-[11px] text-ops-muted">
              {selected.node && <p>Nodo: <span className="text-ops-text">{selected.node.code} — {selected.node.name}</span></p>}
              {selected.camera && <p>Cámara: <span className="text-ops-text">{selected.camera.code}</span></p>}
              <p>Detectado: <span className="text-ops-text">{fmt(selected.detectedAt)}</span></p>
              {selected.resolvedAt && <p>Resuelto: <span className="text-ops-emerald">{fmt(selected.resolvedAt)}</span></p>}
            </div>

            <div className="flex items-center gap-3">
              <select
                className="flex-1 rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text outline-none focus:border-ops-cyan"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button
                onClick={handleStatusChange}
                disabled={saving || newStatus === selected.status}
                className="rounded-ops bg-ops-cyan px-4 py-2 text-sm font-semibold text-ops-bg transition hover:bg-ops-cyan-dim disabled:opacity-50"
              >
                {saving ? "…" : "Actualizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </OpsShell>
  );
}
