"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";

type Project = {
  id: string;
  name: string;
  client: string;
  contract: string | null;
  state: string;
  startDate: string;
  city: { name: string; department: string };
  _count: { centers: number };
};

const stateColor: Record<string, string> = {
  ACTIVE:   "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  INACTIVE: "text-ops-muted border-ops-dim bg-ops-surface",
  ARCHIVED: "text-ops-dim border-ops-dim bg-ops-surface",
};

export default function ProjectsPage() {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<Project[]>("/projects", accessToken)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <OpsShell eyebrow="Estructura" title="Proyectos">
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-ops-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-ops border border-ops-border bg-ops-panel py-16 text-center text-sm text-ops-muted">
          No hay proyectos registrados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops transition hover:border-ops-blue/30">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${stateColor[p.state] ?? ""}`}>
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
                <p className="text-[11px] text-ops-muted">
                  {p.city.name}, {p.city.department}
                </p>
                <p className="text-[11px] text-ops-blue">{p._count.centers} CMC{p._count.centers !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </OpsShell>
  );
}
