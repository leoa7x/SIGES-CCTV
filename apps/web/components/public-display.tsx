"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { CenterGeo, FiberSegmentGeo, NodeGeo } from "./ops-map-libre";

const OpsMapLibre = dynamic(() => import("./ops-map-libre"), { ssr: false });
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";
type View = "noc" | "global" | "map";
type Overview = { generatedAt: string; nodes: { total: number; online: number; offline: number; degraded: number }; cameras: { total: number; online: number; offline: number }; incidents: { open: number; critical: number } };
type NocNode = { id: string; code: string; name: string; state: "ONLINE" | "OFFLINE" | "DEGRADED"; cameras: number; assets: number; lastHeartbeatAt: string | null; telemetry: null | { capturedAt: string; activeHosts: number; activeFlows: number; totalBytesIn: string; totalBytesOut: string } };
type NocPayload = { generatedAt: string; nodes: NocNode[] };
type MapPayload = { generatedAt: string; nodes: NodeGeo[]; centers: Array<Omit<CenterGeo, "contactName" | "phone">>; segments: FiberSegmentGeo[] };

function StateBadge({ state }: { state: string }) {
  const color = state === "ONLINE" ? "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10" : state === "DEGRADED" ? "text-ops-amber border-ops-amber/30 bg-ops-amber/10" : "text-ops-rose border-ops-rose/30 bg-ops-rose/10";
  return <span className={`rounded-full border px-3 py-1 font-mono text-xs font-bold ${color}`}>{state}</span>;
}
function Card({ label, value, sub, color = "text-ops-text" }: { label: string; value: string | number; sub: string; color?: string }) {
  return <div className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-ops-muted">{label}</p><p className={`mt-2 text-4xl font-bold tabular-nums ${color}`}>{value}</p><p className="mt-1 text-xs text-ops-dim">{sub}</p></div>;
}
function Header({ title, generatedAt }: { title: string; generatedAt?: string }) {
  return <header className="flex items-center justify-between gap-4 rounded-ops border border-ops-border bg-ops-panel px-6 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.3em] text-ops-blue">SIGES-CCTV · Puerto Gaitán</p><h1 className="mt-1 text-2xl font-semibold text-ops-text">{title}</h1></div><div className="flex items-center gap-2 rounded-full border border-ops-emerald/30 bg-ops-emerald/10 px-4 py-2 text-xs font-semibold text-ops-emerald"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ops-emerald opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-ops-emerald" /></span>En vivo · {generatedAt ? new Date(generatedAt).toLocaleTimeString("es-CO") : "conectando"}</div></header>;
}

export function PublicDisplay({ view }: { view: View }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [noc, setNoc] = useState<NocPayload | null>(null);
  const [map, setMap] = useState<MapPayload | null>(null);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const endpoint = view === "global" ? "overview" : view;
        const response = await fetch(`${API_URL}/display/${endpoint}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (disposed) return;
        if (view === "global") setOverview(payload); else if (view === "noc") setNoc(payload); else setMap(payload);
        setError("");
      } catch { if (!disposed) setError("Sin conexión con el canal de pantalla NOC"); }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), view === "global" ? 5_000 : 10_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [view]);
  const tour = useMemo(
    () => (noc?.nodes ?? []).slice().sort((a, b) => ({ OFFLINE: 0, DEGRADED: 1, ONLINE: 2 }[a.state] - { OFFLINE: 0, DEGRADED: 1, ONLINE: 2 }[b.state] || a.code.localeCompare(b.code))),
    [noc],
  );
  useEffect(() => { if (view !== "noc" || tour.length < 2) return; const timer = window.setInterval(() => setCursor((n) => (n + 1) % tour.length), 12_000); return () => window.clearInterval(timer); }, [view, tour.length]);
  if (view === "map") return <main className="h-screen overflow-hidden bg-ops-bg p-3 text-ops-text"><div className="flex h-full flex-col gap-3"><Header title="Mapa GIS · Red CCTV" generatedAt={map?.generatedAt} /><div className="min-h-0 flex-1 overflow-hidden rounded-ops border border-ops-border bg-ops-panel">{map ? <OpsMapLibre nodes={map.nodes} centers={map.centers.map((c) => ({ ...c, contactName: null, phone: null }))} fiberSegments={map.segments} /> : <Loading error={error} />}</div></div></main>;
  if (view === "global") return <main className="h-screen overflow-hidden bg-ops-bg p-3 text-ops-text"><div className="flex h-full flex-col gap-3"><Header title="Vista global de red" generatedAt={overview?.generatedAt} /><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Nodos en línea" value={overview?.nodes.online ?? "—"} sub={`de ${overview?.nodes.total ?? 0} nodos`} color="text-ops-emerald" /><Card label="Nodos degradados" value={overview?.nodes.degraded ?? "—"} sub="requieren revisión" color="text-ops-amber" /><Card label="Cámaras activas" value={`${overview && overview.cameras.total ? Math.round((overview.cameras.online / overview.cameras.total) * 100) : 0}%`} sub={`${overview?.cameras.online ?? 0} / ${overview?.cameras.total ?? 0}`} color="text-ops-blue" /><Card label="Incidentes abiertos" value={overview?.incidents.open ?? "—"} sub={`${overview?.incidents.critical ?? 0} críticos`} color={(overview?.incidents.open ?? 0) ? "text-ops-amber" : "text-ops-emerald"} /></section><section className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3"><div className="lg:col-span-2 rounded-ops border border-ops-border bg-ops-panel p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-ops-muted">Estado operativo</p><div className="mt-7 flex h-16 overflow-hidden rounded-full"><div className="bg-ops-emerald transition-all" style={{ width: `${overview?.nodes.total ? (overview.nodes.online / overview.nodes.total) * 100 : 0}%` }} /><div className="bg-ops-amber transition-all" style={{ width: `${overview?.nodes.total ? (overview.nodes.degraded / overview.nodes.total) * 100 : 0}%` }} /><div className="bg-ops-rose transition-all" style={{ width: `${overview?.nodes.total ? (overview.nodes.offline / overview.nodes.total) * 100 : 0}%` }} /></div><div className="mt-5 flex justify-between font-mono text-sm"><span className="text-ops-emerald">● En línea {overview?.nodes.online ?? 0}</span><span className="text-ops-amber">● Degradados {overview?.nodes.degraded ?? 0}</span><span className="text-ops-rose">● Sin respuesta {overview?.nodes.offline ?? 0}</span></div></div><div className="rounded-ops border border-ops-border bg-ops-panel p-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-ops-muted">Canal de pantalla</p><p className="mt-6 text-3xl font-bold text-ops-emerald">ACTIVO</p><p className="mt-2 text-sm text-ops-dim">Actualización automática cada 5 segundos.</p></div></section>{error && <p className="text-center text-sm text-ops-rose">{error}</p>}</div></main>;
  const node = tour[cursor % Math.max(tour.length, 1)];
  return <main className="h-screen overflow-hidden bg-ops-bg p-3 text-ops-text"><div className="flex h-full flex-col gap-3"><Header title="Consola NOC · Recorrido automático" generatedAt={noc?.generatedAt} /><section className="grid gap-3 md:grid-cols-4"><Card label="Revisando ahora" value={node?.code ?? "—"} sub={node?.name ?? "Cargando inventario"} color="text-ops-blue" /><Card label="Estado" value={node?.state ?? "—"} sub={`Nodo ${cursor + 1} de ${tour.length}`} color={node?.state === "ONLINE" ? "text-ops-emerald" : node?.state === "DEGRADED" ? "text-ops-amber" : "text-ops-rose"} /><Card label="Hosts con tráfico" value={node?.telemetry?.activeHosts ?? "—"} sub="observados en el nodo actual" color="text-ops-emerald" /><Card label="Flujos observados" value={node?.telemetry?.activeFlows ?? "—"} sub="no es el total de la red" color="text-ops-blue" /></section><section className="grid min-h-0 flex-1 gap-3 lg:grid-cols-3"><div className="lg:col-span-2 rounded-ops border border-ops-border bg-ops-panel p-6"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.2em] text-ops-muted">Recorrido de nodos</p>{node && <StateBadge state={node.state} />}</div><h2 className="mt-5 text-4xl font-semibold">{node?.name ?? "Cargando…"}</h2><p className="mt-2 font-mono text-lg text-ops-blue">{node?.code}</p><div className="mt-10 grid grid-cols-2 gap-4"><Card label="Cámaras asociadas" value={node?.cameras ?? "—"} sub="inventario oficial" /><Card label="Equipos asociados" value={node?.assets ?? "—"} sub="inventario oficial" /><Card label="Último heartbeat" value={node?.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).toLocaleTimeString("es-CO") : "—"} sub="estado operativo" /><Card label="Última telemetría" value={node?.telemetry?.capturedAt ? new Date(node.telemetry.capturedAt).toLocaleTimeString("es-CO") : "—"} sub="tráfico observado" /></div></div><div className="rounded-ops border border-ops-border bg-ops-panel p-4"><p className="text-xs font-bold uppercase tracking-[.2em] text-ops-muted">Siguiente en recorrido</p><div className="mt-4 space-y-2">{tour.slice(cursor + 1, cursor + 7).concat(tour.slice(0, Math.max(0, cursor + 7 - tour.length))).slice(0, 6).map((item) => <div key={item.id} className="flex items-center justify-between rounded-ops bg-ops-surface px-3 py-3"><span className="font-mono text-xs text-ops-muted">{item.code}</span><StateBadge state={item.state} /></div>)}</div></div></section>{error && <p className="text-center text-sm text-ops-rose">{error}</p>}</div></main>;
}
function Loading({ error }: { error: string }) { return <div className="flex h-full items-center justify-center text-ops-muted">{error || "Cargando pantalla…"}</div>; }
