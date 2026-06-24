"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";

type Entry = {
  id: string;
  date: string;
  activityType: string;
  observations: string | null;
  result: string;
  technician: { name: string | null; email: string };
  node: { code: string; name: string };
};

const resultColor: Record<string, string> = {
  SATISFACTORY: "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  PARTIAL:      "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  FAILED:       "text-ops-rose border-ops-rose/30 bg-ops-rose/10",
  PENDING:      "text-ops-muted border-ops-dim bg-ops-surface",
};

const activityLabels: Record<string, string> = {
  PREVENTIVE_MAINTENANCE: "Mant. Preventivo",
  CORRECTIVE_MAINTENANCE: "Mant. Correctivo",
  INSPECTION:  "Inspección",
  INSTALLATION: "Instalación",
  CONFIGURATION: "Configuración",
  OTHER: "Otro",
};

const resultLabels: Record<string, string> = {
  SATISFACTORY: "Satisfactorio",
  PARTIAL: "Parcial",
  FAILED: "Fallido",
  PENDING: "Pendiente",
};

export default function LogbookPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    apiGet<Entry[]>("/logbook", accessToken)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [accessToken]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return !q || e.node.code.toLowerCase().includes(q) || e.node.name.toLowerCase().includes(q) || (e.technician.name ?? "").toLowerCase().includes(q);
  });

  return (
    <OpsShell eyebrow="Mantenimiento" title="Bitácora Técnica">
      <div className="space-y-4">
        <input
          className="w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text placeholder-ops-dim outline-none transition focus:border-ops-cyan sm:w-72"
          placeholder="Buscar por nodo o técnico…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="rounded-ops border border-ops-border bg-ops-panel">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-ops-muted">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-cyan" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-ops-muted">Sin registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ops-border text-left">
                    {["Fecha", "Nodo", "Actividad", "Resultado", "Técnico", "Observaciones"].map((h) => (
                      <th key={h} className="px-4 py-3 text-[9px] font-bold uppercase tracking-widest text-ops-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="border-b border-ops-border/50 transition hover:bg-ops-surface">
                      <td className="whitespace-nowrap px-4 py-3 text-[11px] text-ops-dim">
                        {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(e.date))}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ops-cyan">{e.node.code}</td>
                      <td className="px-4 py-3 text-[11px] text-ops-text">{activityLabels[e.activityType] ?? e.activityType}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${resultColor[e.result] ?? ""}`}>
                          {resultLabels[e.result] ?? e.result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ops-muted">{e.technician.name ?? e.technician.email}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-[11px] text-ops-dim">{e.observations ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </OpsShell>
  );
}
