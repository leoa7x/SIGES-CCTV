"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsNotice } from "../../components/ops-notice";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";
import {
  buildTopologyCenterGroups,
  type TopologyCenterDetail,
  type TopologyCenterListItem,
  type TopologyNodeItem,
} from "../../lib/network-monitor";
import { toUserFacingError } from "../../lib/presentation";
import { useMonitor } from "../../hooks/use-monitor";

const STATE_BADGE: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

const STATE_DOT: Record<string, string> = {
  ONLINE: "bg-ops-emerald shadow-[0_0_6px_#10b981]",
  DEGRADED: "bg-ops-amber shadow-[0_0_6px_#f59e0b]",
  OFFLINE: "bg-ops-rose shadow-[0_0_6px_#f43f5e]",
  MAINTENANCE: "bg-ops-muted",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  SWITCH: "Switch",
  CABINET: "Gabinete",
  AMPLIFIER: "Amplif.",
  SPLITTER: "Splitter",
  OTHER: "Otro",
};

function formatAssetType(value: string) {
  return value.replaceAll("_", " ");
}

export default function TopologyPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<TopologyNodeItem[]>([]);
  const [centers, setCenters] = useState<TopologyCenterListItem[]>([]);
  const [centerDetailsById, setCenterDetailsById] = useState<Record<string, TopologyCenterDetail>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingCenterIds, setLoadingCenterIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState("");

  const lastEvent = useMonitor(selectedCenterId, accessToken);

  useEffect(() => {
    if (!accessToken) return;
    setLoadError("");
    Promise.all([
      apiGet<TopologyNodeItem[]>("/nodes", accessToken),
      apiGet<TopologyCenterListItem[]>("/monitoring-centers", accessToken),
    ])
      .then(([nodeData, centerData]) => {
        setNodes(nodeData);
        setCenters(centerData);
      })
      .catch((err) => setLoadError(toUserFacingError(err, "No se pudo cargar la topología.")))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (!lastEvent || lastEvent.entityType !== "node") return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === lastEvent.entityId ? { ...node, operativeState: lastEvent.newState } : node,
      ),
    );
  }, [lastEvent]);

  function ensureCenterDetail(centerId: string) {
    if (!accessToken || centerDetailsById[centerId] || loadingCenterIds.has(centerId)) return;

    setLoadingCenterIds((prev) => {
      const next = new Set(prev);
      next.add(centerId);
      return next;
    });

    void apiGet<TopologyCenterDetail>(`/monitoring-centers/${centerId}`, accessToken)
      .then((detail) => {
        setCenterDetailsById((prev) => ({ ...prev, [centerId]: detail }));
      })
      .catch((err) => {
        setLoadError(toUserFacingError(err, "No se pudo cargar el detalle del CMC."));
      })
      .finally(() => {
        setLoadingCenterIds((prev) => {
          const next = new Set(prev);
          next.delete(centerId);
          return next;
        });
      });
  }

  function toggleExpand(centerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(centerId)) {
        next.delete(centerId);
      } else {
        next.add(centerId);
        ensureCenterDetail(centerId);
      }
      return next;
    });
  }

  function handleSelectCenter(centerId: string) {
    setSelectedCenterId((prev) => (prev === centerId ? null : centerId));
    ensureCenterDetail(centerId);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(centerId);
      return next;
    });
  }

  const groups = buildTopologyCenterGroups(nodes, centers, centerDetailsById);

  return (
    <OpsShell eyebrow="Red CCTV" title="Topología">
      {loadError ? (
        <div className="mb-4">
          <OpsNotice tone="error" title="No se pudo cargar la información" message={loadError} onDismiss={() => setLoadError("")} />
        </div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-ops-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
          Cargando topología…
        </div>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-ops-muted">
          No hay CMC ni nodos registrados.
        </p>
      ) : (
        <div className="space-y-2">
          {selectedCenterId ? (
            <div className="flex items-center gap-2 rounded-ops border border-ops-emerald/20 bg-ops-emerald/5 px-4 py-2 text-[11px] text-ops-emerald">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ops-emerald" />
              En vivo — {groups.find((group) => group.centerId === selectedCenterId)?.centerName ?? "CMC"}
              <button onClick={() => setSelectedCenterId(null)} className="ml-auto text-ops-muted hover:text-ops-text">
                ✕
              </button>
            </div>
          ) : null}

          {groups.map((group) => {
            const isExpanded = expandedIds.has(group.centerId);
            const isLive = selectedCenterId === group.centerId;
            const isLoadingCenter = loadingCenterIds.has(group.centerId);
            const online = group.nodes.filter((node) => node.operativeState === "ONLINE").length;
            const offline = group.nodes.filter((node) => node.operativeState === "OFFLINE").length;
            const degraded = group.nodes.filter((node) => node.operativeState === "DEGRADED").length;

            return (
              <div
                key={group.centerId}
                className={`rounded-ops border transition ${
                  isLive ? "border-ops-blue bg-ops-surface" : "border-ops-border bg-ops-panel hover:border-ops-blue/30"
                }`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(group.centerId)}
                    className="text-ops-muted transition hover:text-ops-text"
                    aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  >
                    <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ops-text">{group.centerName}</p>
                    <p className="text-[11px] text-ops-muted">{group.cityName} · {group.projectName}</p>
                  </div>

                  <div className="flex items-center gap-2 text-[11px]">
                    {group.centerAssets.length > 0 ? (
                      <span className="rounded-full border border-ops-blue/30 bg-ops-blue/10 px-2 py-0.5 text-ops-blue">
                        {group.centerAssets.length} CMC
                      </span>
                    ) : null}
                    {online > 0 ? (
                      <span className="rounded-full border border-ops-emerald/30 bg-ops-emerald/10 px-2 py-0.5 text-ops-emerald">
                        {online} en línea
                      </span>
                    ) : null}
                    {degraded > 0 ? (
                      <span className="rounded-full border border-ops-amber/30 bg-ops-amber/10 px-2 py-0.5 text-ops-amber">
                        {degraded} degradados
                      </span>
                    ) : null}
                    {offline > 0 ? (
                      <span className="rounded-full border border-ops-rose/30 bg-ops-rose/10 px-2 py-0.5 text-ops-rose">
                        {offline} offline
                      </span>
                    ) : null}
                  </div>

                  <button
                    onClick={() => handleSelectCenter(group.centerId)}
                    className={`rounded-ops border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                      isLive
                        ? "border-ops-blue bg-ops-blue text-white"
                        : "border-ops-border text-ops-muted hover:border-ops-blue hover:text-ops-blue"
                    }`}
                    title={isLive ? "Desactivar monitoreo en vivo" : "Activar monitoreo en vivo"}
                  >
                    {isLive ? "● Live" : "Live"}
                  </button>
                </div>

                {isExpanded ? (
                  <div className="border-t border-ops-border">
                    <div className="border-b border-ops-border bg-ops-surface/50 px-4 py-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-ops-text">Infraestructura CMC</p>
                          <p className="text-[11px] text-ops-muted">Equipos internos del centro de mando, separados de la red de campo.</p>
                        </div>
                        {isLoadingCenter ? <span className="text-[11px] text-ops-muted">Cargando inventario…</span> : null}
                      </div>

                      {group.centerAssets.length === 0 ? (
                        <div className="rounded-ops border border-dashed border-ops-border bg-ops-panel px-3 py-4 text-[11px] text-ops-muted">
                          Este CMC no tiene equipos internos cargados.
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {group.centerAssets.map((asset) => (
                            <div key={asset.id} className="rounded-ops border border-ops-border bg-ops-panel px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-ops-text">{asset.name}</p>
                                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATE_BADGE[asset.operativeState] ?? STATE_BADGE.MAINTENANCE}`}>
                                  {asset.operativeState}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-ops-muted">
                                {formatAssetType(asset.assetType)} · {asset.ip ?? "sin IP"} · {asset.mac ?? "sin MAC"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ops-text">
                      Rutas / Nodos
                    </div>

                    {group.nodes.length === 0 ? (
                      <div className="px-4 pb-4 text-[11px] text-ops-muted">
                        Este CMC no tiene nodos de campo asociados.
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                            <th className="px-4 py-2">Estado</th>
                            <th className="px-4 py-2">Código</th>
                            <th className="px-4 py-2">Nombre</th>
                            <th className="px-4 py-2 hidden sm:table-cell">Tipo</th>
                            <th className="px-4 py-2 hidden md:table-cell">IP</th>
                            <th className="px-4 py-2 hidden md:table-cell">Cámaras</th>
                            <th className="px-4 py-2 hidden sm:table-cell">Ruta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ops-border">
                          {group.nodes.map((node) => (
                            <tr key={node.id} className="transition hover:bg-ops-surface">
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATE_DOT[node.operativeState] ?? "bg-ops-muted"}`} />
                                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${STATE_BADGE[node.operativeState] ?? STATE_BADGE.MAINTENANCE}`}>
                                    {node.operativeState}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[12px] text-ops-text">{node.code}</td>
                              <td className="px-4 py-2.5 text-ops-text">{node.name}</td>
                              <td className="px-4 py-2.5 hidden sm:table-cell text-ops-muted">
                                {NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}
                              </td>
                              <td className="px-4 py-2.5 hidden md:table-cell font-mono text-[11px] text-ops-dim">
                                {node.ip ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 hidden md:table-cell tabular-nums text-ops-muted">
                                {node._count.cameras}
                              </td>
                              <td className="px-4 py-2.5 hidden sm:table-cell text-[11px] text-ops-muted">
                                {node.route.name}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </OpsShell>
  );
}
