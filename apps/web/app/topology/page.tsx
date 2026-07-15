"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";
import { useMonitor } from "../../hooks/use-monitor";

// ── Types ───────────────────────────────────────────────────────────────────

type NodeFull = {
  id: string;
  code: string;
  name: string;
  operativeState: string;
  nodeType: string;
  ip: string | null;
  _count: { cameras: number };
  route: {
    id: string;
    name: string;
    center: {
      id: string;
      name: string;
      project: { id: string; name: string; city: { id: string; name: string } };
    };
  };
};

type CenterGroup = {
  centerId: string;
  centerName: string;
  projectName: string;
  cityName: string;
  nodes: NodeFull[];
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupByCenters(nodes: NodeFull[]): CenterGroup[] {
  const map = new Map<string, CenterGroup>();
  for (const node of nodes) {
    const { center } = node.route;
    if (!map.has(center.id)) {
      map.set(center.id, {
        centerId: center.id,
        centerName: center.name,
        projectName: center.project.name,
        cityName: center.project.city.name,
        nodes: [],
      });
    }
    map.get(center.id)!.nodes.push(node);
  }
  return Array.from(map.values()).sort((a, b) => a.centerName.localeCompare(b.centerName));
}

const STATE_BADGE: Record<string, string> = {
  ONLINE:      "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED:    "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE:     "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

const STATE_DOT: Record<string, string> = {
  ONLINE:      "bg-ops-emerald shadow-[0_0_6px_#10b981]",
  DEGRADED:    "bg-ops-amber shadow-[0_0_6px_#f59e0b]",
  OFFLINE:     "bg-ops-rose shadow-[0_0_6px_#f43f5e]",
  MAINTENANCE: "bg-ops-muted",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  SWITCH: "Switch", CABINET: "Gabinete", AMPLIFIER: "Amplif.", SPLITTER: "Splitter", OTHER: "Otro",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TopologyPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<NodeFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Real-time state updates for the selected CMC
  const lastEvent = useMonitor(selectedCenterId, accessToken);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<NodeFull[]>("/nodes", accessToken)
      .then(setNodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Apply live state-change event to the local node list
  useEffect(() => {
    if (!lastEvent || lastEvent.entityType !== "node") return;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === lastEvent.entityId ? { ...n, operativeState: lastEvent.newState } : n
      )
    );
  }, [lastEvent]);

  function toggleExpand(centerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(centerId)) {
        next.delete(centerId);
      } else {
        next.add(centerId);
      }
      return next;
    });
  }

  function handleSelectCenter(centerId: string) {
    setSelectedCenterId((prev) => (prev === centerId ? null : centerId));
    // Also expand the row when selecting
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(centerId);
      return next;
    });
  }

  const groups = groupByCenters(nodes);

  return (
    <OpsShell eyebrow="Red CCTV" title="Topología">
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-ops-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
          Cargando topología…
        </div>
      ) : groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-ops-muted">
          No hay nodos registrados. Agrega nodos desde la API.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Live indicator */}
          {selectedCenterId && (
            <div className="flex items-center gap-2 rounded-ops border border-ops-emerald/20 bg-ops-emerald/5 px-4 py-2 text-[11px] text-ops-emerald">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ops-emerald" />
              En vivo — {groups.find((g) => g.centerId === selectedCenterId)?.centerName ?? "CMC"}
              <button
                onClick={() => setSelectedCenterId(null)}
                className="ml-auto text-ops-muted hover:text-ops-text"
              >
                ✕
              </button>
            </div>
          )}

          {groups.map((group) => {
            const isExpanded = expandedIds.has(group.centerId);
            const isLive = selectedCenterId === group.centerId;
            const online = group.nodes.filter((n) => n.operativeState === "ONLINE").length;
            const offline = group.nodes.filter((n) => n.operativeState === "OFFLINE").length;
            const degraded = group.nodes.filter((n) => n.operativeState === "DEGRADED").length;

            return (
              <div
                key={group.centerId}
                className={`rounded-ops border transition ${
                  isLive
                    ? "border-ops-blue bg-ops-surface"
                    : "border-ops-border bg-ops-panel hover:border-ops-blue/30"
                }`}
              >
                {/* CMC header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(group.centerId)}
                    className="text-ops-muted transition hover:text-ops-text"
                    aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  >
                    <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                      ▶
                    </span>
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-ops-text">{group.centerName}</p>
                    <p className="text-[11px] text-ops-muted">
                      {group.cityName} · {group.projectName}
                    </p>
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center gap-2 text-[11px]">
                    {online > 0 && (
                      <span className="rounded-full border border-ops-emerald/30 bg-ops-emerald/10 px-2 py-0.5 text-ops-emerald">
                        {online} en línea
                      </span>
                    )}
                    {degraded > 0 && (
                      <span className="rounded-full border border-ops-amber/30 bg-ops-amber/10 px-2 py-0.5 text-ops-amber">
                        {degraded} degradados
                      </span>
                    )}
                    {offline > 0 && (
                      <span className="rounded-full border border-ops-rose/30 bg-ops-rose/10 px-2 py-0.5 text-ops-rose">
                        {offline} offline
                      </span>
                    )}
                  </div>

                  {/* Live toggle button */}
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

                {/* Node table */}
                {isExpanded && (
                  <div className="border-t border-ops-border">
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
                          <tr
                            key={node.id}
                            className="transition hover:bg-ops-surface"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                                    STATE_DOT[node.operativeState] ?? "bg-ops-muted"
                                  }`}
                                />
                                <span
                                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    STATE_BADGE[node.operativeState] ?? STATE_BADGE.MAINTENANCE
                                  }`}
                                >
                                  {node.operativeState}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[12px] text-ops-text">
                              {node.code}
                            </td>
                            <td className="px-4 py-2.5 text-ops-text">{node.name}</td>
                            <td className="px-4 py-2.5 hidden sm:table-cell text-ops-muted">
                              {NODE_TYPE_LABELS[node.nodeType] ?? node.nodeType}
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell font-mono text-[11px] text-ops-dim">
                              {node.ip ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell text-ops-muted tabular-nums">
                              {node._count.cameras}
                            </td>
                            <td className="px-4 py-2.5 hidden sm:table-cell text-[11px] text-ops-muted">
                              {node.route.name}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </OpsShell>
  );
}
