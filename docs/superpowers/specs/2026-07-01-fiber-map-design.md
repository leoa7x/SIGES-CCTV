# Fiber Route Live Map — Design Spec

**Date:** 2026-07-01  
**Status:** Approved  

## Overview

Visualize fiber cable routes on the live GIS map as animated lines connecting poles (Nodes with `hasPole=true`), with real-time color/animation changes driven by WebSocket state events. Operators can trace new routes directly on the map using a guided drawing mode.

---

## Architecture

### Data model (no schema changes needed)

`FiberSegment` already has everything required:
- `nodeAId` / `nodeBId` — the two pole endpoints
- `waypoints Json` — intermediate bend points `[[lng, lat], ...]`
- `state: FiberState` — ACTIVE | CUT | DEGRADED | MAINTENANCE
- Both `Node` endpoints carry `lat`, `lng`, `operativeState`, `hasPole`

### Event flow (existing infrastructure, no changes)

```
Monitor (Go) → ICMP ping → node OFFLINE
  → POST /internal/state-change
    → API updates Node.operativeState + publishes to Redpanda
      → WebSocket Gateway (OpsGateway)
        → browser receives { nodeId, state }
          → FiberSegment color/animation updates instantly
```

### Components changed / added

| Component | Change |
|---|---|
| `FiberSegmentsService` | Add `findAllGeoJson()` — returns all segments with full node state |
| `FiberSegmentsController` | Add `GET /fiber-segments/geojson` (JWT-guarded) |
| `OpsMapLibre` | New `fiber-segments` prop + `fiber-layer` with animated dasharray |
| `/map/page.tsx` | Fetch segments on load, "Trazar fibra" panel, drawing state machine, toast alerts |
| `useMonitor` hook | Already exists — feeds real-time node state to map |

---

## API

### GET /fiber-segments/geojson

Returns all FiberSegments with resolved node states. Response shape:

```ts
{
  segments: Array<{
    id: string
    state: FiberState                         // segment's own state
    nodeA: { id: string; lat: number; lng: number; operativeState: NodeState }
    nodeB: { id: string; lat: number; lng: number; operativeState: NodeState }
    waypoints: [number, number][]             // [lng, lat] pairs
  }>
}
```

### POST /fiber-segments (existing)

Used by the drawing mode to save each segment as the operator completes it.

Payload: `{ nodeAId, nodeBId, waypoints: [[lng,lat],...], lengthM? }`

### PATCH /fiber-segments/:id (existing)

Used to update waypoints if operator re-traces a segment.

---

## UI — Drawing Mode

### Activation

"Trazar fibra" button in the map toolbar (top-right). Visible to ADMIN and SUPER_ADMIN only.

### Side panel

```
┌─────────────────────────────┐
│ 🔌 Trazar fibra             │
│ Ruta: [dropdown rutas]      │
│─────────────────────────────│
│ Paso 1 de 3                 │
│ Haz click en el primer poste│
│                             │
│ Cadena actual:              │
│  • Poste-01                 │
│  → Poste-03 ✓ (guardado)   │
│  → [siguiente...]           │
│                             │
│ [Cerrar anillo] [Cancelar]  │
└─────────────────────────────┘
```

### State machine

```
idle
  → (select route in dropdown) → select-pole

select-pole
  → (click pole on map) → draw-waypoints   [if first pole: stay in select-pole until second]
  → (click first pole again) → close-ring

draw-waypoints
  → (click map) → add intermediate waypoint, draw dashed blue preview line
  → (double-click) → save FiberSegment via POST, return to select-pole

close-ring
  → save last FiberSegment (closing the ring) → idle
```

### Map visual feedback during drawing

- All `hasPole=true` nodes get a white halo highlight
- Provisional line: blue dashed while drawing waypoints
- Confirmed segment: converts to green animated line immediately
- Cursor: crosshair during all drawing phases

---

## Fiber Layer Visualization

### Color logic (evaluated per segment)

```
effectiveState =
  nodeA.operativeState === OFFLINE || nodeB.operativeState === OFFLINE || segment.state === CUT
    → OFFLINE (red)
  nodeA.operativeState === DEGRADED || nodeB.operativeState === DEGRADED
    → DEGRADED (amber)
  else
    → ONLINE (green)
```

### Animation

Implemented via `requestAnimationFrame` cycling `line-dasharray` offset every 50ms on MapLibre paint:

| State | Color | Animation | Width |
|---|---|---|---|
| ONLINE | `#10b981` (ops-emerald) | Dashes move forward — "data flowing" | 3px |
| DEGRADED | `#f59e0b` (ops-amber) | Static, no animation | 3px |
| OFFLINE/CUT | `#f43f5e` (ops-rose) | Static, no animation | 4px |
| Not traced | — | Hidden (no waypoints = not rendered) | — |

Only ONLINE segments animate. Amber and red are intentionally still — visually communicates "something stopped."

---

## Real-time Alerts

Trigger: WebSocket `state-change` event with `state = OFFLINE` for a node that is an endpoint of one or more FiberSegments.

Toast format (bottom-right, stacks):
```
⚠️  Corte detectado
Poste-03 → Poste-07
[Centrar en mapa]     ✕
```

- Duration: 8 seconds (auto-dismiss)
- "Centrar en mapa" → `map.flyTo` to midpoint of the segment
- Multiple simultaneous cuts → stacked toasts

---

## Out of Scope

- Editing / re-tracing existing segments (can be added later)
- Waypoint snap-to-road (external API dependency)
- Per-segment length calculation from waypoints
- Role-based alert routing (future Plan)
