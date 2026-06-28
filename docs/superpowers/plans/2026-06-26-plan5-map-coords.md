# Map Coordinates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the map show located nodes and let operators set coordinates by clicking on the map for nodes that have none.

**Architecture:** No schema migration needed — `lat Float` and `lng Float` already exist on the `Node` model. Nodes without coordinates have lat=0, lng=0 (the DB default). The fix is: (1) filter out 0,0 nodes in `findGeoJson()`; (2) on the map page, fetch all nodes and split into located vs. unlocated; (3) add a side panel with an "Ubicar" button per unlocated node that enters placement mode (crosshair cursor + one map click → PATCH /nodes/:id). The `OpsMapLibre` component gets an optional `onPlaceNode` prop that drives cursor and click capture.

**Tech Stack:** NestJS 11 (API), Next.js 15 + MapLibre GL v5 (web), `apiPatch` from `lib/api.ts` (already exists).

## Global Constraints

- No schema migrations — lat/lng fields already exist as `Float` (not nullable) on the Node model
- "Unlocated" is defined as: `lat === 0 AND lng === 0` (the Prisma Float default)
- No new npm packages
- TypeScript: 0 errors (`cd apps/web && npx tsc --noEmit`)
- git author: `leoa7x` / `leo.sanchez@thecicorp.com`
- All existing API guards and patterns (JWT AuthGuard, service/controller split) must be preserved

---

## File Map

```
apps/api/src/nodes/nodes.service.ts    MODIFY — filter 0,0 in findGeoJson()
apps/web/components/ops-map-libre.tsx  MODIFY — add onPlaceNode prop + placement useEffect
apps/web/app/map/page.tsx              REWRITE — fetch all nodes, split, side panel + placement
```

---

## Task 1: Fix findGeoJson — filter out lat=0 AND lng=0 nodes

**Files:**
- Modify: `apps/api/src/nodes/nodes.service.ts`

**Interfaces:**
- Produces: `GET /nodes/geojson` returns only nodes where `lat ≠ 0 AND lng ≠ 0`

---

- [ ] **Step 1: Open the service and locate `findGeoJson`**

File: `apps/api/src/nodes/nodes.service.ts` lines 66-70.

Current implementation:
```typescript
findGeoJson() {
  return this.prisma.node.findMany({
    select: { id: true, code: true, name: true, lat: true, lng: true, operativeState: true },
  });
}
```

- [ ] **Step 2: Add the 0,0 filter**

Replace the method body:

```typescript
findGeoJson() {
  return this.prisma.node.findMany({
    where: { NOT: { lat: 0, lng: 0 } },
    select: { id: true, code: true, name: true, lat: true, lng: true, operativeState: true },
  });
}
```

`NOT: { lat: 0, lng: 0 }` is Prisma's way of saying `NOT (lat=0 AND lng=0)`, which equals `lat≠0 OR lng≠0`. This excludes only the exact default (0,0) while allowing any real coordinate.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: no output (0 errors).

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.name "leoa7x"
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.email "leo.sanchez@thecicorp.com"
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/src/nodes/nodes.service.ts
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "fix(api): exclude lat=0,lng=0 nodes from geojson endpoint"
```

---

## Task 2: Map page — coordinate placement UI + OpsMapLibre placement mode

**Files:**
- Modify: `apps/web/components/ops-map-libre.tsx`
- Rewrite: `apps/web/app/map/page.tsx`

**Interfaces:**
- Consumes (ops-map-libre): `nodes: NodeGeo[]`, `onPlaceNode?: (lat: number, lng: number) => void`
- Consumes (map/page): `GET /nodes` → `NodeItem[]`, `apiPatch("/nodes/:id", token, { lat, lng })`
- `NodeGeo` type (already exported from ops-map-libre.tsx): `{ id, code, name, lat: number, lng: number, operativeState }`

---

### Part A: OpsMapLibre — add placement mode

- [ ] **Step 1: Add `onPlaceNodeRef` and the `onPlaceNode` prop**

Replace the full `apps/web/components/ops-map-libre.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

export type NodeGeo = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

export default function OpsMapLibre({
  nodes,
  onPlaceNode,
}: {
  nodes: NodeGeo[];
  onPlaceNode?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Mutable ref so the circle click handler can check placement mode without
  // triggering the heavy nodes useEffect on every onPlaceNode change.
  const onPlaceNodeRef = useRef(onPlaceNode);
  useEffect(() => { onPlaceNodeRef.current = onPlaceNode; }, [onPlaceNode]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [-74.0758, 4.5981], // Bogotá default
      zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => setMapReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update nodes source whenever nodes or mapReady changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: nodes.map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.lng, n.lat] },
        properties: {
          id: n.id,
          code: n.code,
          name: n.name,
          state: n.operativeState,
        },
      })),
    };

    const src = map.getSource("nodes") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geojson);
    } else {
      map.addSource("nodes", { type: "geojson", data: geojson });

      map.addLayer({
        id: "nodes-circle",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": 9,
          "circle-color": [
            "match", ["get", "state"],
            "ONLINE",      "#10b981",
            "DEGRADED",    "#f59e0b",
            "OFFLINE",     "#f43f5e",
            "MAINTENANCE", "#64748b",
            "#94a3b8",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0A2540",
          "circle-opacity": 0.9,
        },
      });

      map.on("click", "nodes-circle", (e) => {
        // Suppress popup while placement mode is active
        if (onPlaceNodeRef.current) return;
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as { code: string; name: string; state: string };
        const stateHex: Record<string, string> = {
          ONLINE: "#10b981", DEGRADED: "#f59e0b", OFFLINE: "#f43f5e", MAINTENANCE: "#64748b",
        };
        new maplibregl.Popup({ className: "ops-popup" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px/1.4 Arial,sans-serif;padding:4px 2px;color:#e2e8f0;background:#0A2540">` +
            `<strong style="color:#e2e8f0">${p.code}</strong><br/>${p.name}<br/>` +
            `<span style="color:${stateHex[p.state] ?? "#94a3b8"}">${p.state}</span></div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "nodes-circle", () => {
        if (onPlaceNodeRef.current) return;
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "nodes-circle", () => {
        if (onPlaceNodeRef.current) return;
        map.getCanvas().style.cursor = "";
      });

      if (nodes.length > 0) {
        const lngs = nodes.map((n) => n.lng);
        const lats = nodes.map((n) => n.lat);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 14 }
        );
      }
    }
  }, [nodes, mapReady]);

  // Placement mode: crosshair cursor + capture one map click
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!onPlaceNode) {
      map.getCanvas().style.cursor = "";
      return;
    }
    map.getCanvas().style.cursor = "crosshair";
    const handler = (e: maplibregl.MapMouseEvent) => {
      onPlaceNode(e.lngLat.lat, e.lngLat.lng);
    };
    map.once("click", handler);
    return () => {
      map.off("click", handler);
      map.getCanvas().style.cursor = "";
    };
  }, [onPlaceNode, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

### Part B: Map page — side panel + placement state

- [ ] **Step 2: Rewrite `apps/web/app/map/page.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/components/ops-map-libre.tsx apps/web/app/map/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add coordinate placement mode to map page"
```

---

## Task 3: Push

**Files:** No new files.

---

- [ ] **Step 1: Final TypeScript check — both packages**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1 && echo "API OK"
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1 && echo "WEB OK"
```

Expected: `API OK` and `WEB OK` with no errors between them.

- [ ] **Step 2: Push**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV push origin HEAD
```

- [ ] **Step 3: Verify**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV log --oneline origin/main -4
```

Expected: top 2 commits are the Plan 5 commits.
