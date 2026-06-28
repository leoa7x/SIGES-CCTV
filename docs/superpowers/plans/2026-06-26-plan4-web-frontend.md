# Web Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TypeScript compilation, replace the Leaflet map with MapLibre GL JS, and build the missing Topology page with real-time node state via WebSocket.

**Architecture:** Three independent deliverables: (1) A one-line tsconfig fix that clears all 12 DOM-type TS errors plus removal of the broken Leaflet component; (2) a new `ops-map-libre.tsx` client component using MapLibre GL JS v5 with a GeoJSON circle layer coloured by node state; (3) a `/topology` page that groups nodes by monitoring centre, shows state badges, and subscribes to live state-change events via `useMonitor`.

**Tech Stack:** Next.js 15 App Router, MapLibre GL JS ^5.24.0 (already installed), socket.io-client (already installed), Tailwind CSS (ops-* colours), TypeScript 5.8.

## Global Constraints

- All TypeScript must compile with 0 errors: `npx tsc --noEmit` from `apps/web/`
- Brand colours: `ops-emerald` (#10b981) = ONLINE, `ops-amber` (#f59e0b) = DEGRADED, `ops-rose` (#f43f5e) = OFFLINE, `ops-muted` (#94A3B8) = MAINTENANCE
- No new npm packages — use `maplibre-gl` and `socket.io-client` (already in package.json)
- All new pages are `"use client"`, wrapped in `<OpsShell>` (named export from `../../components/ops-shell`)
- `useAuth()` from `../../components/auth-provider` supplies `accessToken`
- `apiGet<T>(path, token)` from `../../lib/api` for all API calls
- `useMonitor(centerId: string | null)` from `../../hooks/use-monitor` for real-time
- git author: `leoa7x` / `leo.sanchez@thecicorp.com`

---

## File Map

```
apps/web/
  tsconfig.json                    MODIFY — add "lib": ["ES2022","dom","dom.iterable"]
  app/globals.css                  MODIFY — remove Leaflet CSS, add MapLibre CSS @import
  components/ops-map.tsx           DELETE — broken react-leaflet import
  app/map/page.tsx                 REWRITE — use MapLibre component
  components/ops-map-libre.tsx     CREATE — MapLibre GL map component
  app/topology/page.tsx            CREATE — hierarchy viewer + live state
```

---

## Task 1: Fix TypeScript Errors

**Files:**
- Modify: `apps/web/tsconfig.json`
- Delete: `apps/web/components/ops-map.tsx`
- Modify: `apps/web/app/map/page.tsx`
- Modify: `apps/web/app/globals.css`

**Root cause:** `tsconfig.base.json` sets `"lib": ["ES2022"]` — missing `dom`. This causes all 13 errors:
- `Cannot find name 'window'` (session.ts, auth-provider.tsx, socket.ts)
- `Property 'value' does not exist on type 'EventTarget & HTMLInputElement'` (incidents, logbook, login)
- `Cannot find module 'react-leaflet'` (ops-map.tsx — fixed by deleting the file)

**Interfaces:**
- Produces: 0 TypeScript errors; `app/map/page.tsx` shows a loading placeholder (replaced in Task 2)

---

- [ ] **Step 1: Add `dom` to tsconfig**

Edit `apps/web/tsconfig.json`. Add `"lib"` to `compilerOptions`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Delete `ops-map.tsx`**

```bash
rm apps/web/components/ops-map.tsx
```

- [ ] **Step 3: Replace `app/map/page.tsx` with a placeholder**

Replace the entire content of `apps/web/app/map/page.tsx`:

```tsx
"use client";

import { OpsShell } from "../../components/ops-shell";

export default function MapPage() {
  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center rounded-ops border border-ops-border bg-ops-panel text-ops-muted">
        Mapa cargando…
      </div>
    </OpsShell>
  );
}
```

- [ ] **Step 4: Remove Leaflet CSS from globals.css**

In `apps/web/app/globals.css`, remove these lines (lines 29–36):

```css
/* Leaflet map dark override */
.leaflet-container {
  background: #0e1724 !important;
}

.leaflet-tile-pane {
  filter: brightness(0.7) invert(1) contrast(1.3) hue-rotate(180deg) saturate(0.8);
}
```

- [ ] **Step 5: Verify 0 TypeScript errors**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: no output (0 errors).

- [ ] **Step 6: Verify dev build starts**

```bash
cd apps/web && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully` or build completes without type errors.

- [ ] **Step 7: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.name "leoa7x"
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.email "leo.sanchez@thecicorp.com"
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/tsconfig.json apps/web/app/globals.css apps/web/app/map/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV rm apps/web/components/ops-map.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "fix(web): add dom lib to tsconfig, remove broken Leaflet component"
```

---

## Task 2: MapLibre GL Map

**Files:**
- Create: `apps/web/components/ops-map-libre.tsx`
- Rewrite: `apps/web/app/map/page.tsx`
- Modify: `apps/web/app/globals.css` (add MapLibre CSS)

**Interfaces:**
- Consumes: `NodeGeo[]` prop
- Produces: `<OpsMapLibre nodes={NodeGeo[]} />` default export

---

- [ ] **Step 1: Add MapLibre CSS to globals.css**

Add at the very top of `apps/web/app/globals.css` (before `@tailwind base`):

```css
@import 'maplibre-gl/dist/maplibre-gl.css';
```

Final top of globals.css:
```css
@import 'maplibre-gl/dist/maplibre-gl.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Create `apps/web/components/ops-map-libre.tsx`**

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

export default function OpsMapLibre({ nodes }: { nodes: NodeGeo[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "nodes-circle", () => {
        map.getCanvas().style.cursor = "";
      });

      // Fit to nodes if we have any
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

  return <div ref={containerRef} className="h-full w-full" />;
}
```

- [ ] **Step 3: Rewrite `apps/web/app/map/page.tsx`**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";
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

export default function MapPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<NodeGeo[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<NodeGeo[]>("/nodes/geojson", accessToken).then(setNodes).catch(console.error);
  }, [accessToken]);

  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="relative h-[calc(100vh-10rem)] w-full overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
        <OpsMapLibre nodes={nodes} />
      </div>
      <p className="mt-2 text-[10px] text-ops-dim">
        {nodes.length} nodos registrados · Clic en marcador para detalles
      </p>
    </OpsShell>
  );
}
```

- [ ] **Step 4: Verify TypeScript still clean**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/components/ops-map-libre.tsx apps/web/app/map/page.tsx apps/web/app/globals.css
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): replace Leaflet with MapLibre GL JS map"
```

---

## Task 3: Topology Page

**Files:**
- Create: `apps/web/app/topology/page.tsx`

**Interfaces:**
- Consumes: `GET /nodes` (returns `NodeFull[]` with nested route→center→project→city hierarchy)
- Consumes: `useMonitor(centerId: string | null)` from `../../hooks/use-monitor`
- Produces: `/topology` route — CMC accordion with node state badges + live updates

**API shape — each node from `GET /nodes`:**
```typescript
{
  id: string;
  code: string;
  name: string;
  operativeState: string;   // "ONLINE" | "OFFLINE" | "DEGRADED" | "MAINTENANCE"
  nodeType: string;         // "SWITCH" | "CABINET" | etc.
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
}
```

---

- [ ] **Step 1: Create `apps/web/app/topology/page.tsx`**

```tsx
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
  const lastEvent = useMonitor(selectedCenterId);

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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/topology/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add topology page with live state via useMonitor"
```

---

## Task 4: Push

**Files:**
- No new files — just push everything

---

- [ ] **Step 1: Final TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 2: Push to remote**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV push origin HEAD
```

Expected: pushes all Plan 4 commits to `origin/main`.

- [ ] **Step 3: Verify remote**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV log --oneline origin/main -5
```

Expected: top 3 commits include the Plan 4 feat commits.

- [ ] **Step 4: Commit (only if .env.example needs update)**

No env changes needed for Plan 4 — all environment variables (`NEXT_PUBLIC_API_URL`) were already documented in Plan 1.
