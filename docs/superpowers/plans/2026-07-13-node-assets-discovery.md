# Node Assets Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/admin/nodes` so each node works as a pole with coordinates, network discovery configuration, official node assets, node-level analytics, asset-level analytics, and camera synchronization.

**Architecture:** Keep `Node` as the physical pole entity and add normalized relational models for discovery runs, temporary discovered devices, official node assets, and analytics assignments. Expose a single richer node detail API for the admin screen, then evolve `/admin/nodes` from a flat CRUD table into a detail-oriented management workspace with manual asset confirmation and analytics configuration.

**Tech Stack:** Prisma, NestJS 11, Next.js 15, TypeScript, class-validator

## Global Constraints

- El nodo representa el poste físico.
- El nodo debe tener coordenada.
- El nodo tendrá `IP principal` obligatoria.
- El nodo tendrá `subred/CIDR` opcional.
- El escaneo usa la subred explícita si existe; si no, se deriva desde la IP principal.
- El catálogo de analíticas será fijo con opción `Otra` y texto libre adicional.
- El descubrimiento será automático temporal, pero el inventario oficial solo se crea por confirmación manual del operador.
- Las cámaras confirmadas deben seguir visibles y sincronizadas en `/admin/cameras`.
- Herramienta base de descubrimiento: `LAN-Orangutan`.

---

### Task 1: Add Prisma models for node assets, discovery, and analytics

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`

**Interfaces:**
- Consumes: existing `Node`, `Camera`, `User`
- Produces: Prisma models `NodeAsset`, `NodeDiscoveryJob`, `NodeDiscoveredDevice`, `AnalyticsCatalog`, `NodeAnalyticsAssignment`, `NodeAssetAnalyticsAssignment` and extended `Node` fields `primaryIp`, `scanSubnetCidr`

- [ ] Extend `Node` and add enums/models for assets, discovery, and analytics.
- [ ] Seed a small analytics catalog plus one sample node asset so local bootstrap remains usable.
- [ ] Run `npm run db:push` and confirm Prisma client regenerates successfully.

### Task 2: Add backend CRUD and detail response for node inventory

**Files:**
- Modify: `apps/api/src/nodes/nodes.service.ts`
- Modify: `apps/api/src/nodes/nodes.controller.ts`
- Create: `apps/api/src/node-assets/node-assets.service.ts`
- Create: `apps/api/src/node-assets/node-assets.controller.ts`
- Create: `apps/api/src/node-assets/node-assets.module.ts`
- Create: `apps/api/src/node-analytics/node-analytics.service.ts`
- Create: `apps/api/src/node-analytics/node-analytics.controller.ts`
- Create: `apps/api/src/node-analytics/node-analytics.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: Prisma models from Task 1
- Produces:
  - `GET /nodes` with counts and network fields
  - `GET /nodes/:id` with route, assets, discoveries, analytics
  - `POST /nodes`
  - `PATCH /nodes/:id`
  - `POST /nodes/:id/assets`
  - `PATCH /node-assets/:id`
  - `GET /analytics-catalog`
  - `POST /nodes/:id/analytics`
  - `POST /node-assets/:id/analytics`

- [ ] Extend node DTOs/service to accept `lat`, `lng`, `primaryIp`, and `scanSubnetCidr`.
- [ ] Implement node assets service/controller for list, create, and update.
- [ ] Implement analytics catalog and assignment service/controller for node and asset levels.
- [ ] Enrich node detail response for the admin workspace with related inventories and assignments.

### Task 3: Synchronize confirmed camera assets with `/admin/cameras`

**Files:**
- Modify: `apps/api/src/node-assets/node-assets.service.ts`
- Modify: `apps/api/src/cameras/cameras.service.ts` if helper reuse is needed

**Interfaces:**
- Consumes: `NodeAssetCreateDto`, Prisma `Camera`
- Produces: camera creation or linking when `assetType` is `CAMARA_PTZ` or `CAMARA_FIJA`

- [ ] Add server-side rule: creating a camera-type `NodeAsset` creates or updates a `Camera`.
- [ ] Match existing cameras by `ip` first and reuse when possible.
- [ ] Keep non-camera asset types isolated from camera sync logic.

### Task 4: Build the node admin workspace UI

**Files:**
- Modify: `apps/web/app/admin/nodes/page.tsx`

**Interfaces:**
- Consumes: node detail API, node assets API, analytics API
- Produces: a detail-oriented `/admin/nodes` screen with:
  - node CRUD
  - network fields
  - official asset inventory
  - node analytics
  - asset analytics

- [ ] Keep the existing node list, but add selection and detail loading.
- [ ] Expand node create/edit forms with coordinates, primary IP, and subnet.
- [ ] Add official asset creation/edit forms with type, name, IP, MAC, vendor, model, hostname, and state.
- [ ] Add node analytics and asset analytics assignment forms using fixed catalog plus `Otra`.

### Task 5: Verify end-to-end node workflow

**Files:**
- Modify: `README.md` only if workflow changed materially

**Interfaces:**
- Produces: verified API build, web build, and usable node admin workflow

- [ ] Run `npm run build --workspace=apps/api`.
- [ ] Run `npm run db:push`.
- [ ] Run `npm run build --workspace=apps/web`.
- [ ] Verify `/admin/nodes` loads without 500 errors and the node detail route returns enriched data.
