"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsNotice } from "../../components/ops-notice";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../lib/api";
import { toUserFacingError } from "../../lib/presentation";
import { shouldRoleUseGranularPermissions } from "../../lib/user-permissions";
import type { NodeGeo, CenterGeo, FiberSegmentGeo } from "../../components/ops-map-libre";
import { useMonitorAll } from "../../hooks/use-monitor-all";

const OpsMapLibre = dynamic(() => import("../../components/ops-map-libre"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-ops-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
      Cargando mapa…
    </div>
  ),
});

// Matches GET /nodes/geojson — the lightweight map projection (no relation
// includes/_count), unlike GET /nodes used by the admin CRUD list.
type NodeItem = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
  hasPole: boolean;
};

type CenterApiItem = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
};

type DrawPhase = "idle" | "select-pole" | "draw-waypoints";

type DrawPole = { id: string; code: string; lat: number; lng: number };

type FiberToast = {
  id: string;
  nodeACode: string;
  nodeBCode: string;
  midLng: number;
  midLat: number;
};

export default function MapPage() {
  const { accessToken, user } = useAuth();
  const [isMural, setIsMural] = useState(false);
  const [allNodes, setAllNodes] = useState<NodeItem[]>([]);
  const [centers, setCenters] = useState<CenterGeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [placingNode, setPlacingNode] = useState<NodeItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [fiberSegments, setFiberSegments] = useState<FiberSegmentGeo[]>([]);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [drawPoles, setDrawPoles] = useState<DrawPole[]>([]);
  const [drawWaypoints, setDrawWaypoints] = useState<[number, number][]>([]);
  const [savingSegment, setSavingSegment] = useState(false);
  const [toasts, setToasts] = useState<FiberToast[]>([]);
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setIsMural(new URLSearchParams(window.location.search).get("mural") === "1");
  }, []);

  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    let disposed = false;
    const loadMapState = async () => {
      try {
        const [nodes, rawCenters, { segments }] = await Promise.all([
          apiGet<NodeItem[]>("/nodes/geojson", accessToken),
          apiGet<CenterApiItem[]>("/monitoring-centers", accessToken),
          apiGet<{ segments: FiberSegmentGeo[] }>("/fiber-segments/geojson", accessToken),
        ]);
        if (disposed) return;
        setAllNodes(nodes);
        setFiberSegments(segments);
        setCenters(
          rawCenters
            .filter((c) => c.lat != null && c.lng != null)
            .map((c) => ({
              id: c.id,
              name: c.name,
              address: c.address,
              contactName: c.contactName,
              phone: c.phone,
              lat: c.lat as number,
              lng: c.lng as number,
            })),
        );
        setLoadError("");
      } catch (err) {
        if (!disposed) setLoadError(toUserFacingError(err, "No se pudo actualizar el mapa de red."));
      } finally {
        if (!disposed) setLoading(false);
      }
    };
    void loadMapState();
    const timer = window.setInterval(() => void loadMapState(), 10_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [accessToken]);

  const locatedNodes: NodeGeo[] = useMemo(
    () =>
      allNodes
        .filter((n) => !(n.lat === 0 && n.lng === 0))
        .map((n) => ({
          id: n.id,
          code: n.code,
          name: n.name,
          lat: n.lat,
          lng: n.lng,
          operativeState: n.operativeState,
          hasPole: n.hasPole,
        })),
    [allNodes],
  );

  const unlocatedNodes = useMemo(
    () => allNodes.filter((n) => n.lat === 0 && n.lng === 0),
    [allNodes],
  );

  const handlePlaceNode = useCallback(
    async (lat: number, lng: number) => {
      if (!placingNode || !accessToken) return;
      setSaving(true);
      setActionError("");
      try {
        await apiPatch(`/nodes/${placingNode.id}`, accessToken, { lat, lng });
        setAllNodes((prev) =>
          prev.map((n) => (n.id === placingNode.id ? { ...n, lat, lng } : n))
        );
      } catch (err) {
        setActionError(toUserFacingError(err, "No se pudieron guardar las coordenadas del nodo."));
      } finally {
        setSaving(false);
        setPlacingNode(null);
      }
    },
    [placingNode, accessToken]
  );

  const handleFiberPoleClick = useCallback(
    (nodeId: string, lat: number, lng: number) => {
      const node = allNodes.find((n) => n.id === nodeId);
      const pole: DrawPole = { id: nodeId, code: node?.code ?? nodeId, lat, lng };

      if (drawPhase === "select-pole") {
        if (drawPoles.length === 0) {
          // First pole
          setDrawPoles([pole]);
        } else {
          // Second pole → enter draw-waypoints
          setDrawPoles((prev) => [...prev, pole]);
          setDrawPhase("draw-waypoints");
        }
      }
    },
    [drawPhase, drawPoles, allNodes]
  );

  const handleFiberMapClick = useCallback(
    (lat: number, lng: number) => {
      if (drawPhase === "draw-waypoints") {
        setDrawWaypoints((prev) => [...prev, [lng, lat] as [number, number]]);
      }
    },
    [drawPhase]
  );

  const handleFiberDblClick = useCallback(async () => {
    if (drawPhase !== "draw-waypoints" || drawPoles.length < 2 || !accessToken) return;
    const poleA = drawPoles[drawPoles.length - 2];
    const poleB = drawPoles[drawPoles.length - 1];
    setSavingSegment(true);
    setActionError("");
    try {
      const created = await apiPost<{ id: string }>("/fiber-segments", accessToken, {
        nodeAId: poleA.id,
        nodeBId: poleB.id,
        waypoints: drawWaypoints,
      });
      const nodeAInfo = allNodes.find((n) => n.id === poleA.id);
      const nodeBInfo = allNodes.find((n) => n.id === poleB.id);
      const newSeg: FiberSegmentGeo = {
        id: created.id,
        state: "ACTIVE",
        nodeA: {
          id: poleA.id,
          code: nodeAInfo?.code ?? poleA.id,
          lat: poleA.lat,
          lng: poleA.lng,
          operativeState: nodeAInfo?.operativeState ?? "ONLINE",
        },
        nodeB: {
          id: poleB.id,
          code: nodeBInfo?.code ?? poleB.id,
          lat: poleB.lat,
          lng: poleB.lng,
          operativeState: nodeBInfo?.operativeState ?? "ONLINE",
        },
        waypoints: drawWaypoints,
      };
      setFiberSegments((prev) => [...prev, newSeg]);
      // Continue from poleB as the new starting pole
      setDrawPoles([poleB]);
      setDrawWaypoints([]);
      setDrawPhase("select-pole");
    } catch (err) {
      setActionError(toUserFacingError(err, "No se pudo guardar el segmento de fibra."));
    } finally {
      setSavingSegment(false);
    }
  }, [drawPhase, drawPoles, drawWaypoints, accessToken, allNodes]);

  const cancelDrawing = useCallback(() => {
    setDrawPhase("idle");
    setDrawPoles([]);
    setDrawWaypoints([]);
  }, []);

  const handleFiberInvalidPoleClick = useCallback(() => {
    setActionError("Ese nodo no está marcado como poste — selecciona uno con el halo blanco para trazar fibra.");
  }, []);

  const { events: monitorEvents, drain: drainMonitorEvents } = useMonitorAll(
    centers.map((c) => c.id),
    accessToken,
  );

  // Read via ref inside the event effect below instead of listing fiberSegments
  // as a dependency — depending on state that the same effect also writes
  // (via setFiberSegments) re-triggers the effect on every commit, and since
  // `.map()` always allocates a new array even when nothing actually changed,
  // that becomes an infinite render loop the moment any node event arrives.
  const fiberSegmentsRef = useRef(fiberSegments);
  useEffect(() => { fiberSegmentsRef.current = fiberSegments; }, [fiberSegments]);

  useEffect(() => {
    if (monitorEvents.length === 0) return;

    // A single "last event" slot silently drops earlier events whenever two
    // arrive before this effect gets to run — e.g. two different nodes going
    // OFFLINE in the same tick. useMonitorAll queues everything since the
    // last drain, so process the whole batch, then discard it. Last state
    // per node wins within the batch (matches the previous single-event
    // behavior — a node that flapped OFFLINE→ONLINE within the batch ends up
    // ONLINE, not stuck showing a stale cut).
    const latestStateByNodeId = new Map<string, string>();
    for (const evt of monitorEvents) {
      if (evt.entityType === "node") latestStateByNodeId.set(evt.entityId, evt.newState);
    }

    if (latestStateByNodeId.size > 0) {
      // Live-update each node's own marker color on the map.
      setAllNodes((prev) => {
        let changed = false;
        const next = prev.map((n) => {
          const newState = latestStateByNodeId.get(n.id);
          if (newState !== undefined && n.operativeState !== newState) {
            changed = true;
            return { ...n, operativeState: newState };
          }
          return n;
        });
        return changed ? next : prev;
      });

      // Update operative state on affected fiber segments (bail out to the
      // same array reference when nothing matched, so this doesn't itself
      // cause a render when the batch only touches nodes with no segment).
      setFiberSegments((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          let seg = s;
          const newAState = latestStateByNodeId.get(s.nodeA.id);
          if (newAState !== undefined && seg.nodeA.operativeState !== newAState) {
            changed = true;
            seg = { ...seg, nodeA: { ...seg.nodeA, operativeState: newAState } };
          }
          const newBState = latestStateByNodeId.get(s.nodeB.id);
          if (newBState !== undefined && seg.nodeB.operativeState !== newBState) {
            changed = true;
            seg = { ...seg, nodeB: { ...seg.nodeB, operativeState: newBState } };
          }
          return seg;
        });
        return changed ? next : prev;
      });

      // Toast for every node whose latest state in this batch is OFFLINE.
      const now = monitorEvents[monitorEvents.length - 1].timestamp;
      for (const [nodeId, state] of latestStateByNodeId) {
        if (state !== "OFFLINE") continue;
        const affected = fiberSegmentsRef.current.filter(
          (s) => s.nodeA.id === nodeId || s.nodeB.id === nodeId
        );
        affected.forEach((seg) => {
          const toast: FiberToast = {
            id: `${seg.id}-${now}`,
            nodeACode: seg.nodeA.code,
            nodeBCode: seg.nodeB.code,
            midLng: (seg.nodeA.lng + seg.nodeB.lng) / 2,
            midLat: (seg.nodeA.lat + seg.nodeB.lat) / 2,
          };
          setToasts((prev) => [...prev, toast]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }, 8000);
        });
      }
    }

    drainMonitorEvents();
  }, [monitorEvents, drainMonitorEvents]);

  const canManageFiber = !!user &&
    (!shouldRoleUseGranularPermissions(user.role) || user.permissions.includes("MANAGE_FIBER"));

  const drawingPreview: [number, number][] =
    drawPhase === "draw-waypoints" && drawPoles.length >= 2
      ? [
          [drawPoles[drawPoles.length - 2].lng, drawPoles[drawPoles.length - 2].lat],
          ...drawWaypoints,
          [drawPoles[drawPoles.length - 1].lng, drawPoles[drawPoles.length - 1].lat],
        ]
      : [];

  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV" kiosk={isMural}>
      {loadError ? (
        <div className="mb-3">
          <OpsNotice tone="error" title="No se pudo cargar la información" message={loadError} onDismiss={() => setLoadError("")} />
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-3">
          <OpsNotice tone="error" title="No se pudo guardar" message={actionError} onDismiss={() => setActionError("")} />
        </div>
      ) : null}
      <div className={`flex gap-3 ${isMural ? "h-full" : "h-[calc(100vh-10rem)]"}`}>
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

          {/* Fiber toolbar button — top-right corner, above map controls */}
          {!isMural && <div className="absolute right-10 top-2 z-10">
            {drawPhase === "idle" && canManageFiber && (
              <button
                onClick={() => setDrawPhase("select-pole")}
                className="rounded border border-ops-border bg-ops-panel px-3 py-1.5 text-xs font-semibold text-ops-text hover:border-ops-blue hover:text-ops-blue"
              >
                + Trazar fibra
              </button>
            )}
            {drawPhase !== "idle" && (
              <button
                onClick={cancelDrawing}
                className="rounded border border-ops-border bg-ops-panel px-3 py-1.5 text-xs font-semibold text-ops-rose hover:bg-ops-rose/10"
              >
                × Cancelar
              </button>
            )}
          </div>}

          {isMural && (
            <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-ops border border-ops-border bg-ops-panel/95 px-4 py-3 shadow-ops backdrop-blur">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-ops-blue">SIGES-CCTV · Puerto Gaitán</p>
                <h1 className="mt-1 text-lg font-semibold text-ops-text">Mapa GIS · Estado operativo en vivo</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-ops-emerald/30 bg-ops-emerald/10 px-3 py-1.5 text-ops-emerald">{locatedNodes.filter((node) => node.operativeState === "ONLINE").length} en línea</span>
                <span className="rounded-full border border-ops-amber/30 bg-ops-amber/10 px-3 py-1.5 text-ops-amber">{locatedNodes.filter((node) => node.operativeState === "DEGRADED").length} degradados</span>
                <span className="rounded-full border border-ops-rose/30 bg-ops-rose/10 px-3 py-1.5 text-ops-rose">{locatedNodes.filter((node) => node.operativeState === "OFFLINE").length} fuera de línea</span>
                <a href="/map" className="rounded-ops border border-ops-border px-3 py-1.5 text-ops-muted hover:border-ops-blue/50 hover:text-ops-text">Salir del mural</a>
              </div>
            </div>
          )}

          <OpsMapLibre
            nodes={locatedNodes}
            centers={centers}
            onPlaceNode={placingNode && !saving ? handlePlaceNode : undefined}
            fiberSegments={fiberSegments}
            fiberDrawMode={drawPhase !== "idle"}
            onFiberPoleClick={handleFiberPoleClick}
            onFiberInvalidPoleClick={handleFiberInvalidPoleClick}
            onFiberMapClick={handleFiberMapClick}
            onFiberDblClick={handleFiberDblClick}
            drawingPreview={drawingPreview}
          />
        </div>

        {/* Side panel — unlocated nodes */}
        {!isMural && (unlocatedNodes.length > 0 || loading) && (
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

        {/* Drawing mode panel */}
        {!isMural && drawPhase !== "idle" && (
          <div className="flex w-56 flex-col rounded-ops border border-ops-border bg-ops-panel">
            <div className="border-b border-ops-border px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                Trazar fibra
              </p>
              <p className="mt-0.5 text-[11px] text-ops-text">
                {drawPhase === "select-pole" && drawPoles.length === 0 && "Haz clic en el primer poste"}
                {drawPhase === "select-pole" && drawPoles.length === 1 && "Haz clic en el siguiente poste"}
                {drawPhase === "draw-waypoints" && "Clic: waypoint · Doble clic: guardar segmento"}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {savingSegment && (
                <div className="flex items-center gap-2 text-[10px] text-ops-muted">
                  <div className="h-3 w-3 animate-spin rounded-full border border-ops-border border-t-ops-blue" />
                  Guardando…
                </div>
              )}
              {drawPoles.length === 0 && !savingSegment && (
                <p className="text-[10px] text-ops-dim">Cadena vacía</p>
              )}
              <ul className="space-y-1">
                {drawPoles.map((p, i) => (
                  <li key={p.id} className="text-[11px] text-ops-text">
                    <span className="text-ops-muted">{i === 0 ? "●" : "→"}</span>{" "}
                    <span className="font-mono">{p.code}</span>
                    {i < drawPoles.length - 1 && (
                      <span className="ml-1 text-[9px] text-ops-muted">✓</span>
                    )}
                  </li>
                ))}
                {drawPhase === "draw-waypoints" && (
                  <li className="text-[10px] text-ops-muted">
                    {drawWaypoints.length} waypoint{drawWaypoints.length !== 1 ? "s" : ""}
                  </li>
                )}
              </ul>
            </div>

            <div className="border-t border-ops-border px-3 py-2">
              <button
                onClick={cancelDrawing}
                className="w-full rounded border border-ops-border px-2 py-1 text-[10px] text-ops-muted hover:border-ops-rose hover:text-ops-rose"
              >
                Cancelar traza
              </button>
            </div>
          </div>
        )}
      </div>

      {!isMural && <p className="mt-2 text-[10px] text-ops-dim">
        {locatedNodes.length} nodos ubicados · {unlocatedNodes.length} pendientes de coordenadas
        {placingNode ? " · Haz clic en el mapa para colocar el nodo" : ""}
      </p>}

      {/* Fiber alert toasts — bottom-right stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-start gap-3 rounded-ops border border-ops-rose/40 bg-ops-panel px-4 py-3 shadow-lg"
            >
              <span className="mt-0.5 text-sm">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-ops-rose">Corte detectado</p>
                <p className="mt-0.5 font-mono text-[11px] text-ops-text">
                  {t.nodeACode} → {t.nodeBCode}
                </p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="ml-2 shrink-0 text-ops-muted hover:text-ops-text"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </OpsShell>
  );
}
