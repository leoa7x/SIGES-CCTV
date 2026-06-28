# CMC Contact Info + GIS + Map Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add contact info (phone, responsible name) and GIS coordinates (auto-geocoded via Nominatim) to MonitoringCenter, display them in the admin form, and render CMC markers as distinct blue squares on the existing MapLibre map.

**Architecture:** A Prisma migration adds four nullable fields to MonitoringCenter. The NestJS service auto-geocodes on create by resolving the center's address + city name through the project relation. The MapLibre component receives a new `centers` prop and renders HTML marker elements (CSS squares) alongside the existing GeoJSON node circles. The map page fetches `/monitoring-centers` and filters centers that have coordinates.

**Tech Stack:** Prisma 6 migration, NestJS 11, Nominatim REST API (free, no key), Next.js 15, MapLibre GL v5, TypeScript 5.8.

## Global Constraints

- Git author: `leoa7x <leo.sanchez@thecicorp.com>` — configure before every commit
- No tests — verification gate per task: `cd apps/api && npx tsc --noEmit` for API, `cd apps/web && npx tsc --noEmit` for web
- Nominatim URL: `https://nominatim.openstreetmap.org/search?q=<encoded>&format=json&limit=1&countrycodes=co`
- Nominatim User-Agent: `SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)`
- Input CSS class (verbatim): `"w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none"`
- CMC marker style (verbatim): `"width:14px;height:14px;background:#1D4ED8;border:2px solid #fff;border-radius:3px;cursor:pointer;"`
- No hard DELETE endpoints
- Monorepo root: `/mnt/c/Users/ingel/SIGES-CCTV`

---

## File Map

```
apps/api/
  prisma/schema.prisma                                   MODIFY — add phone, contactName, lat, lng to MonitoringCenter
  prisma/migrations/<ts>_center-contact-gis/             CREATED by migrate dev
  src/monitoring-centers/monitoring-centers.service.ts   MODIFY — new DTOs, Nominatim geocoding

apps/web/
  app/admin/centers/page.tsx                             MODIFY — new fields, address in table, OpsModal saving prop
  components/ops-map-libre.tsx                           MODIFY — CenterGeo type, centers prop, HTML markers
  app/map/page.tsx                                       MODIFY — fetch centers, pass to OpsMapLibre
```

---

## Task 1: Prisma schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `MonitoringCenter` with new fields `phone String?`, `contactName String?`, `lat Float?`, `lng Float?` available in `@prisma/client`

---

- [ ] **Step 1: Read the current schema**

```bash
grep -A 15 "model MonitoringCenter" /mnt/c/Users/ingel/SIGES-CCTV/apps/api/prisma/schema.prisma
```

- [ ] **Step 2: Add four fields to the MonitoringCenter model**

Inside `model MonitoringCenter { ... }`, after `address String?`, add:

```prisma
  phone          String?
  contactName    String?
  lat            Float?
  lng            Float?
```

The block should look like:

```prisma
model MonitoringCenter {
  id          String      @id @default(uuid())
  name        String
  address     String?
  phone       String?
  contactName String?
  lat         Float?
  lng         Float?
  state       EntityState @default(ACTIVE)
  projectId   String
  project     Project     @relation(fields: [projectId], references: [id])
  routes      Route[]
  incidents   Incident[]  @relation("CenterIncidents")
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}
```

- [ ] **Step 3: Run migration**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx prisma migrate dev --name center-contact-gis
```

Expected: migration created and applied, Prisma client regenerated. Output includes `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.name leoa7x
git -C /mnt/c/Users/ingel/SIGES-CCTV config user.email leo.sanchez@thecicorp.com
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/prisma/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): add phone, contactName, lat, lng to MonitoringCenter"
```

---

## Task 2: Monitoring-centers API — DTOs + Nominatim geocoding

**Files:**
- Modify: `apps/api/src/monitoring-centers/monitoring-centers.service.ts`

**Interfaces:**
- Consumes: new MonitoringCenter fields from Task 1
- Produces:
  - `CreateCenterDto` with `phone?`, `contactName?`, `lat?`, `lng?`
  - `UpdateCenterDto` with `phone?`, `contactName?`, `lat?`, `lng?`
  - `create()` auto-geocodes using `address ?? name` + city name via `project.city.name` when lat/lng absent
  - `findAll()` response includes all new fields (Prisma returns them automatically)

---

- [ ] **Step 1: Read the current service file**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/src/monitoring-centers/monitoring-centers.service.ts
```

- [ ] **Step 2: Rewrite the file**

```typescript
import { Injectable } from "@nestjs/common";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCenterDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsString() @IsNotEmpty() projectId!: string;
}

export class UpdateCenterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class MonitoringCentersService {
  constructor(private prisma: PrismaService) {}

  private async geocode(
    query: string,
    cityName: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const q = `${query}, ${cityName}, Colombia`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=co`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)" },
      });
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {}
    return null;
  }

  findAll(projectId?: string) {
    return this.prisma.monitoringCenter.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: { include: { city: true } },
        _count: { select: { routes: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.monitoringCenter.findUniqueOrThrow({
      where: { id },
      include: {
        project: { include: { city: true } },
        routes: { include: { _count: { select: { nodes: true } } } },
      },
    });
  }

  async create(dto: CreateCenterDto) {
    const { projectId, ...rest } = dto;
    let { lat, lng } = rest;

    if (lat == null || lng == null) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { city: true },
      });
      if (project?.city) {
        const searchTerm = rest.address ?? rest.name;
        const coords = await this.geocode(searchTerm, project.city.name);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
    }

    return this.prisma.monitoringCenter.create({
      data: { ...rest, lat, lng, project: { connect: { id: projectId } } },
    });
  }

  update(id: string, dto: UpdateCenterDto) {
    return this.prisma.monitoringCenter.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.monitoringCenter.update>[0]["data"],
    });
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/src/monitoring-centers/monitoring-centers.service.ts
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): add contact info and Nominatim geocoding to centers service"
```

---

## Task 3: Frontend `/admin/centers` — enhanced form

**Files:**
- Modify: `apps/web/app/admin/centers/page.tsx`

**Interfaces:**
- Consumes:
  - `GET /monitoring-centers` → `CenterItem[]` — each item now has `phone`, `contactName`, `lat`, `lng` (all nullable)
  - `POST /monitoring-centers` body: `{ name, address?, phone?, contactName?, lat?, lng?, projectId }`
  - `PATCH /monitoring-centers/:id` body: `{ name?, address?, phone?, contactName?, lat?, lng?, state? }`

---

- [ ] **Step 1: Read the current page**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/web/app/admin/centers/page.tsx
```

- [ ] **Step 2: Rewrite the file**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CenterItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  lat: number | null;
  lng: number | null;
  state: string;
  project: { id: string; name: string; city: { name: string } };
  _count: { routes: number };
};
type ProjectRef = { id: string; name: string };
type CreateForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; projectId: string;
};
type EditForm = {
  name: string; address: string; phone: string; contactName: string;
  lat: string; lng: string; state: string;
};

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const EMPTY_CREATE: CreateForm = {
  name: "", address: "", phone: "", contactName: "", lat: "", lng: "", projectId: "",
};

export default function CentersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CenterItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CenterItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", address: "", phone: "", contactName: "", lat: "", lng: "", state: "ACTIVE",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        apiGet<CenterItem[]>("/monitoring-centers", accessToken),
        apiGet<ProjectRef[]>("/projects", accessToken),
      ]);
      setItems(c); setProjects(p);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ ...EMPTY_CREATE, projectId: projects[0]?.id ?? "" });
    setModalOpen(true);
  }

  function openEdit(item: CenterItem) {
    setEditing(item);
    setEditForm({
      name: item.name,
      address: item.address ?? "",
      phone: item.phone ?? "",
      contactName: item.contactName ?? "",
      lat: item.lat != null ? String(item.lat) : "",
      lng: item.lng != null ? String(item.lng) : "",
      state: item.state,
    });
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }

  function parseOptionalNumber(s: string): number | undefined {
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/monitoring-centers/${editing.id}`, accessToken, {
          name: editForm.name,
          address: editForm.address || undefined,
          phone: editForm.phone || undefined,
          contactName: editForm.contactName || undefined,
          lat: parseOptionalNumber(editForm.lat),
          lng: parseOptionalNumber(editForm.lng),
          state: editForm.state,
        });
      } else {
        await apiPost("/monitoring-centers", accessToken, {
          name: createForm.name,
          address: createForm.address || undefined,
          phone: createForm.phone || undefined,
          contactName: createForm.contactName || undefined,
          lat: parseOptionalNumber(createForm.lat),
          lng: parseOptionalNumber(createForm.lng),
          projectId: createForm.projectId,
        });
      }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  const f = editing ? editForm : createForm;
  const setF = (fn: (prev: EditForm) => EditForm) =>
    editing ? setEditForm(fn) : setCreateForm((p) => fn(p as unknown as EditForm) as unknown as CreateForm);

  return (
    <OpsShell eyebrow="Administración" title="Centros de Monitoreo (CMC)">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} centros</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo CMC
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Proyecto / Ciudad</th>
                <th className="px-4 py-3 hidden md:table-cell">Dirección</th>
                <th className="px-4 py-3 hidden lg:table-cell">Contacto</th>
                <th className="px-4 py-3 hidden lg:table-cell">GIS</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ops-text">{item.name}</p>
                    {item.phone && <p className="text-[10px] text-ops-muted">{item.phone}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ops-muted">
                    {item.project.name} · {item.project.city.name}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ops-muted max-w-[180px] truncate">
                    {item.address ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-ops-muted">
                    {item.contactName ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {item.lat != null && item.lng != null ? (
                      <span className="rounded border border-ops-emerald/30 bg-ops-emerald/10 px-1.5 py-0.5 text-[9px] text-ops-emerald">GIS ✓</span>
                    ) : (
                      <span className="rounded border border-ops-border bg-ops-surface px-1.5 py-0.5 text-[9px] text-ops-dim">sin coord</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.routes}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {item.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar CMC" : "Nuevo CMC"} onClose={closeModal} saving={saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={f.name} required placeholder="CMC Central"
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} />
          </div>

          {/* Project (create only) */}
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Proyecto</label>
              <select className={INPUT} value={createForm.projectId}
                onChange={(e) => setCreateForm((p) => ({ ...p, projectId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {/* Address */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Dirección</label>
            <input className={INPUT} value={f.address} placeholder="Calle 1 # 2-3"
              onChange={(e) => setF((p) => ({ ...p, address: e.target.value }))} />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Responsable</label>
              <input className={INPUT} value={f.contactName} placeholder="Nombre del operador"
                onChange={(e) => setF((p) => ({ ...p, contactName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Teléfono</label>
              <input className={INPUT} value={f.phone} placeholder="601 123 4567"
                onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          {/* GIS coordinates */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              Coordenadas GIS{!editing && <span className="ml-1 font-normal text-ops-dim">(auto-geocodificadas al crear si se dejan vacías)</span>}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className={INPUT} value={f.lat} placeholder="Latitud (ej. 4.0756)"
                onChange={(e) => setF((p) => ({ ...p, lat: e.target.value }))} />
              <input className={INPUT} value={f.lng} placeholder="Longitud (ej. -72.0836)"
                onChange={(e) => setF((p) => ({ ...p, lng: e.target.value }))} />
            </div>
          </div>

          {/* State (edit only) */}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state}
                onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal}
              className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors. Common issue: `setF` type-cast may surface a TS error — if so, replace the `setF` helper with inline per-field handlers (same pattern as cities page).

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/centers/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): enhance centers admin with contact info, GIS coords, address in table"
```

---

## Task 4: Map — CMC markers on MapLibre

**Files:**
- Modify: `apps/web/components/ops-map-libre.tsx`
- Modify: `apps/web/app/map/page.tsx`

**Interfaces:**
- Consumes:
  - `CenterGeo` type exported from `ops-map-libre.tsx`: `{ id: string; name: string; address: string | null; contactName: string | null; phone: string | null; lat: number; lng: number }`
  - `OpsMapLibre` receives new optional prop `centers?: CenterGeo[]`
  - Map page fetches `GET /monitoring-centers` and maps to `CenterGeo[]` filtering where `lat != null && lng != null`
- Produces: CMC markers appear on the map as 14×14 blue squares with popup on click

---

- [ ] **Step 1: Read both files**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/web/components/ops-map-libre.tsx
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/web/app/map/page.tsx
```

- [ ] **Step 2: Update `ops-map-libre.tsx`**

Add the `CenterGeo` export and `centers` prop. Insert the centers `useEffect` after the placement-mode `useEffect` (around line 162, before the `return` statement).

**Add the type export** after the `NodeGeo` type:

```typescript
export type CenterGeo = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  lat: number;
  lng: number;
};
```

**Update the component signature** — add `centers` prop:

```typescript
export default function OpsMapLibre({
  nodes,
  centers,
  onPlaceNode,
}: {
  nodes: NodeGeo[];
  centers?: CenterGeo[];
  onPlaceNode?: (lat: number, lng: number) => void;
}) {
```

**Add the markers ref** inside the component body, after `const onPlaceNodeRef`:

```typescript
  const centerMarkersRef = useRef<maplibregl.Marker[]>([]);
```

**Add the centers `useEffect`** — insert it after the placement-mode `useEffect` (the one that manages the `crosshair` cursor), before the final `return`:

```typescript
  // Render CMC markers as blue squares
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove previous markers
    centerMarkersRef.current.forEach((m) => m.remove());
    centerMarkersRef.current = [];

    (centers ?? []).forEach((c) => {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;background:#1D4ED8;border:2px solid #fff;border-radius:3px;cursor:pointer;";
      el.title = c.name;

      const popup = new maplibregl.Popup({ offset: 12, className: "ops-popup" }).setHTML(
        `<div style="font:12px/1.6 Arial,sans-serif;padding:4px 2px;color:#e2e8f0;background:#0A2540;min-width:140px">` +
        `<strong style="color:#93c5fd;display:block;margin-bottom:2px">CMC</strong>` +
        `<strong style="color:#e2e8f0">${c.name}</strong>` +
        (c.address ? `<br/><span style="color:#94a3b8">${c.address}</span>` : "") +
        (c.contactName ? `<br/><span style="color:#94a3b8">${c.contactName}</span>` : "") +
        (c.phone ? `<br/><span style="color:#94a3b8">${c.phone}</span>` : "") +
        `</div>`,
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(map);

      centerMarkersRef.current.push(marker);
    });

    return () => {
      centerMarkersRef.current.forEach((m) => m.remove());
      centerMarkersRef.current = [];
    };
  }, [centers, mapReady]);
```

- [ ] **Step 3: Update `apps/web/app/map/page.tsx`**

**Add the `CenterGeo` import** at the top:

```typescript
import type { NodeGeo, CenterGeo } from "../../components/ops-map-libre";
```

**Add `CenterItem` type** (minimal shape from API response) after the `NodeItem` type:

```typescript
type CenterApiItem = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
};
```

**Add `centers` state** after the `allNodes` state:

```typescript
  const [centers, setCenters] = useState<CenterGeo[]>([]);
```

**Extend the `useEffect`** that fetches nodes to also fetch centers:

Replace the existing `useEffect`:
```typescript
  useEffect(() => {
    if (!accessToken) { setLoading(false); return; }
    Promise.all([
      apiGet<NodeItem[]>("/nodes", accessToken),
      apiGet<CenterApiItem[]>("/monitoring-centers", accessToken),
    ])
      .then(([nodes, rawCenters]) => {
        setAllNodes(nodes);
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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accessToken]);
```

**Pass `centers` to `OpsMapLibre`** — update the component usage in the JSX:

```tsx
<OpsMapLibre nodes={locatedNodes} centers={centers} onPlaceNode={placingNode ? handlePlaceNode : undefined} />
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/components/ops-map-libre.tsx apps/web/app/map/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): render CMC markers as blue squares on GIS map"
```

---

## Task 5: Push

**Files:** None new.

---

- [ ] **Step 1: Final TypeScript check**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1 && echo "API OK"
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1 && echo "WEB OK"
```

Expected: `API OK` and `WEB OK` with no errors.

- [ ] **Step 2: Push**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV push origin HEAD
```

- [ ] **Step 3: Verify**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV log --oneline origin/main -6
```

Expected: top 4 commits are the Plan 8 feature commits.
