# Fiber Route Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first working slice of the new fiber-route data model so `/admin/routes` can capture trunk cables, derived cables, node-backed points, splice-backed points, and basic splice composition data.

**Architecture:** Keep the existing `Route` CRUD intact and add a parallel fiber-data model under new Prisma entities and API endpoints. Build the admin screen as a wizard-style data editor over the new endpoints, without coupling it to the map module yet.

**Tech Stack:** Prisma, NestJS 11, Next.js 15, TypeScript, class-validator

## Global Constraints

- Reuse `Node` when a point corresponds to existing topology.
- If a point is not an existing `Node`, it must be represented as a splice and require splice data.
- Do not overload `FiberSegment` with splice/cable continuity logic.
- Capture is data-first; advanced map visualization remains out of scope for this implementation.

---

### Task 1: Add the fiber-route Prisma model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/prisma/seed.ts`

**Interfaces:**
- Produces: Prisma models for `FiberCable`, `FiberPoint`, `SpliceClosure`, `SpliceCableLeg`, `SpliceBlockInput`, `SpliceFiberConnection`

- [ ] Add enums for cable kind, point kind, leg direction, block kind, and document status.
- [ ] Add new Prisma models and relations to `Route` and `Node`.
- [ ] Extend seed data minimally so the new relations do not break local bootstrap.

### Task 2: Expose backend CRUD for the new fiber data

**Files:**
- Create: `apps/api/src/fiber-cables/fiber-cables.service.ts`
- Create: `apps/api/src/fiber-cables/fiber-cables.controller.ts`
- Create: `apps/api/src/fiber-cables/fiber-cables.module.ts`
- Create: `apps/api/src/splices/splices.service.ts`
- Create: `apps/api/src/splices/splices.controller.ts`
- Create: `apps/api/src/splices/splices.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/routes/routes.service.ts`
- Modify: `apps/api/src/routes/routes.controller.ts`

**Interfaces:**
- Produces: endpoints to list route fiber data, create cables, create points, create splices, add cable legs, add block inputs, and expand block inputs to per-fiber records

- [ ] Add service/controller/module for fiber cables with create/list/update operations.
- [ ] Add service/controller/module for splices, legs, block inputs, and block expansion.
- [ ] Extend route detail response so the admin wizard can load the full fiber tree from one route endpoint.

### Task 3: Build the admin routes data wizard

**Files:**
- Modify: `apps/web/app/admin/routes/page.tsx`
- Modify: `apps/web/lib/api.ts` if new helper behavior is required

**Interfaces:**
- Consumes: existing route CRUD plus new fiber-data endpoints
- Produces: wizard-style UI to create a cable, attach origin/destination points, create splice-backed points, and capture splice composition blocks

- [ ] Keep the existing route table, but add a “documentar fibra” flow on top of route detail.
- [ ] Add wizard state for route selection, cable creation, point binding, splice creation, cable legs, and block capture.
- [ ] Support choosing an existing node or creating a splice when defining a point.
- [ ] Support adding derivation cables from a splice.

### Task 4: Verify bootstrap and data flow

**Files:**
- Modify: `README.md` only if the workflow changed materially

**Interfaces:**
- Produces: verified backend build and DB sync for the new data model

- [ ] Run `npm run build --workspace=apps/api`.
- [ ] Run `npm run db:push`.
- [ ] Verify the admin routes page still builds through the web app.
- [ ] Verify the new endpoints can be loaded locally without breaking login or existing route CRUD.
