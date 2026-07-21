"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { GrafanaPanelEmbed } from "../../components/grafana-panel-embed";
import { useAuth } from "../../components/auth-provider";
import { useMonitorAll } from "../../hooks/use-monitor-all";
import { apiGet, type GrafanaEmbedDescriptor } from "../../lib/api";
import {
  applyDashboardSummaryStateChange,
  buildGrafanaEmbedModel,
  buildObservabilityEmbedPath,
  type DashboardSummary,
} from "../../lib/network-monitor";

type Summary = DashboardSummary;
type MonitoringCenterRef = { id: string };

const severityColors: Record<string, string> = {
  CRITICAL: "text-ops-rose border-ops-rose/30 bg-ops-rose/10",
  HIGH:     "text-orange-400 border-orange-400/30 bg-orange-400/10",
  MEDIUM:   "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  LOW:      "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
};

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent?: string }) {
  return (
    <div className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
      <p className="text-[9px] font-bold uppercase tracking-widest text-ops-muted">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent ?? "text-ops-text"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ops-dim">{sub}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewEmbedDescriptor, setOverviewEmbedDescriptor] = useState<GrafanaEmbedDescriptor | null>(null);
  const [loadingOverviewEmbed, setLoadingOverviewEmbed] = useState(false);
  const lastEvent = useMonitorAll(centerIds, accessToken);
  const overviewEmbed = overviewEmbedDescriptor ? buildGrafanaEmbedModel(overviewEmbedDescriptor) : null;

  const loadData = useCallback(async () => {
    if (!accessToken) {
      setData(null);
      setCenterIds([]);
      setLoading(false);
      return;
    }

    try {
      const [summary, centers] = await Promise.all([
        apiGet<Summary>("/dashboard/summary", accessToken),
        apiGet<MonitoringCenterRef[]>("/monitoring-centers", accessToken),
      ]);
      setData(summary);
      setCenterIds(centers.map((center) => center.id));
    } catch {
      setData(null);
      setCenterIds([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!lastEvent) return;
    setData((prev) => applyDashboardSummaryStateChange(prev, lastEvent));
  }, [lastEvent]);

  useEffect(() => {
    if (!accessToken) return;
    const interval = window.setInterval(() => {
      void loadData();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [accessToken, loadData]);

  useEffect(() => {
    if (!accessToken) {
      setOverviewEmbedDescriptor(null);
      setLoadingOverviewEmbed(false);
      return;
    }

    let cancelled = false;
    setLoadingOverviewEmbed(true);
    void apiGet<GrafanaEmbedDescriptor>(
      buildObservabilityEmbedPath({ dashboard: "network-command-view" }),
      accessToken,
    )
      .then((descriptor) => {
        if (!cancelled) setOverviewEmbedDescriptor(descriptor);
      })
      .catch(() => {
        if (!cancelled) setOverviewEmbedDescriptor(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingOverviewEmbed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100);

  return (
    <OpsShell eyebrow="Centro de Operaciones" title="Panel General">
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-ops-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
          Cargando estadísticas…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Nodos en línea"
              value={loading ? "—" : `${data?.nodes.online ?? 0}`}
              sub={`de ${data?.nodes.total ?? 0} nodos totales`}
              accent={data && data.nodes.offline > 0 ? "text-ops-amber" : "text-ops-emerald"}
            />
            <StatCard
              label="Cámaras activas"
              value={`${pct(data?.cameras.online ?? 0, data?.cameras.total ?? 1)}%`}
              sub={`${data?.cameras.online ?? 0} / ${data?.cameras.total ?? 0} en línea`}
              accent="text-ops-blue"
            />
            <StatCard
              label="Incidentes abiertos"
              value={data?.incidents.open ?? 0}
              sub="sin resolver"
              accent={data && data.incidents.open > 0 ? "text-ops-amber" : "text-ops-emerald"}
            />
            <StatCard
              label="Incidentes críticos"
              value={data?.incidents.critical ?? 0}
              sub="severidad crítica"
              accent={data && data.incidents.critical > 0 ? "text-ops-rose" : "text-ops-emerald"}
            />
          </div>

          {/* Node health bar */}
          {data && data.nodes.total > 0 && (
            <div className="rounded-ops border border-ops-border bg-ops-panel p-5">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-ops-muted">Estado de nodos</p>
              <div className="flex h-3 overflow-hidden rounded-full">
                <div className="bg-ops-emerald transition-all" style={{ width: `${pct(data.nodes.online, data.nodes.total)}%` }} />
                <div className="bg-ops-amber transition-all" style={{ width: `${pct(data.nodes.degraded, data.nodes.total)}%` }} />
                <div className="bg-ops-rose transition-all" style={{ width: `${pct(data.nodes.offline, data.nodes.total)}%` }} />
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-ops-muted">
                <span><span className="font-semibold text-ops-emerald">{data.nodes.online}</span> en línea</span>
                <span><span className="font-semibold text-ops-amber">{data.nodes.degraded}</span> degradados</span>
                <span><span className="font-semibold text-ops-rose">{data.nodes.offline}</span> fuera de línea</span>
              </div>
            </div>
          )}

          <div className="rounded-ops border border-ops-border bg-ops-panel p-5">
            <div className="mb-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-ops-muted">Observabilidad</p>
              <p className="mt-1 text-sm font-semibold text-ops-text">Tráfico y comportamiento global de la red</p>
            </div>
            <GrafanaPanelEmbed
              title={overviewEmbed?.title ?? "Vista global de red"}
              src={overviewEmbed?.src ?? null}
              loading={loadingOverviewEmbed}
            />
          </div>

          {/* Recent incidents */}
          <div className="rounded-ops border border-ops-border bg-ops-panel">
            <div className="border-b border-ops-border px-5 py-4">
              <p className="text-sm font-semibold text-ops-text">Incidentes recientes</p>
            </div>
            {!data?.recentIncidents.length ? (
              <p className="py-10 text-center text-sm text-ops-muted">Sin incidentes abiertos</p>
            ) : (
              <div className="divide-y divide-ops-border">
                {data.recentIncidents.map((inc) => (
                  <div key={inc.id} className="flex items-start gap-4 px-5 py-3 transition hover:bg-ops-surface">
                    <span className={`mt-0.5 rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${severityColors[inc.severity] ?? severityColors.MEDIUM}`}>
                      {inc.severity}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ops-text">{inc.title}</p>
                      <p className="text-[11px] text-ops-muted">
                        {inc.node ? `${inc.node.code} — ${inc.node.name}` : "Sin nodo asignado"}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-[11px] text-ops-dim">
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(inc.detectedAt))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </OpsShell>
  );
}
