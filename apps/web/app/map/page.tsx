"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPatch } from "../../lib/api";
import type { NodeGeo } from "../../components/ops-map-libre";

const OpsMapLibre = dynamic(() => import("../../components/ops-map-libre"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-ops-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
      Cargando mapa…
    </div>
  ),
});

// Minimal shape we need from GET /nodes (service returns full Node + relations)
type NodeItem = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
};

export default function MapPage() {
  const { accessToken } = useAuth();
  const [allNodes, setAllNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingNode, setPlacingNode] = useState<NodeItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    apiGet<NodeItem[]>("/nodes", accessToken)
      .then(setAllNodes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken]);

  const locatedNodes: NodeGeo[] = allNodes.filter(
    (n) => !(n.lat === 0 && n.lng === 0)
  ) as NodeGeo[];

  const unlocatedNodes = allNodes.filter((n) => n.lat === 0 && n.lng === 0);

  const handlePlaceNode = useCallback(
    async (lat: number, lng: number) => {
      if (!placingNode || !accessToken) return;
      setSaving(true);
      try {
        await apiPatch(`/nodes/${placingNode.id}`, accessToken, { lat, lng });
        setAllNodes((prev) =>
          prev.map((n) => (n.id === placingNode.id ? { ...n, lat, lng } : n))
        );
      } catch (err) {
        console.error("Error al guardar coordenadas:", err);
      } finally {
        setSaving(false);
        setPlacingNode(null);
      }
    },
    [placingNode, accessToken]
  );

  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="flex h-[calc(100vh-10rem)] gap-3">
        {/* Map container */}
        <div className="relative flex-1 overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          {/* Placement banner */}
          {placingNode && (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-ops bg-ops-blue/90 px-4 py-2 text-sm text-white backdrop-blur">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
              {saving
                ? "Guardando…"
                : `Haz clic en el mapa para ubicar ${placingNode.code}`}
              <button
                onClick={() => setPlacingNode(null)}
                className="ml-auto rounded px-2 py-0.5 hover:bg-white/20"
              >
                × Cancelar
              </button>
            </div>
          )}

          <OpsMapLibre
            nodes={locatedNodes}
            onPlaceNode={placingNode && !saving ? handlePlaceNode : undefined}
          />
        </div>

        {/* Side panel — unlocated nodes */}
        {(unlocatedNodes.length > 0 || loading) && (
          <div className="flex w-64 flex-col rounded-ops border border-ops-border bg-ops-panel">
            <div className="border-b border-ops-border px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                Sin coordenadas
              </p>
              {!loading && (
                <p className="text-xl font-bold tabular-nums text-ops-text">
                  {unlocatedNodes.length}
                </p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
                </div>
              ) : (
                <ul className="divide-y divide-ops-border">
                  {unlocatedNodes.map((node) => (
                    <li key={node.id} className="flex items-center gap-2 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-ops-text">
                          {node.code}
                        </p>
                        <p className="truncate text-[10px] text-ops-muted">{node.name}</p>
                      </div>
                      <button
                        onClick={() =>
                          setPlacingNode((prev) =>
                            prev?.id === node.id ? null : node
                          )
                        }
                        disabled={saving}
                        className={`flex-shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
                          placingNode?.id === node.id
                            ? "border-ops-blue bg-ops-blue text-white"
                            : "border-ops-border text-ops-muted hover:border-ops-blue hover:text-ops-blue"
                        }`}
                      >
                        {placingNode?.id === node.id ? "●" : "Ubicar"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[10px] text-ops-dim">
        {locatedNodes.length} nodos ubicados · {unlocatedNodes.length} pendientes de coordenadas
        {placingNode ? " · Haz clic en el mapa para colocar el nodo" : ""}
      </p>
    </OpsShell>
  );
}
