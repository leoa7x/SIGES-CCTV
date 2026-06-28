# Builders CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all missing CRUD pages for the full data hierarchy (Ciudad → Proyecto → CMC → Ruta → Nodo → Cámara), add logbook entry creation, and add user management — making the application fully self-serviceable without touching the API directly.

**Architecture:** All CRUD pages share the same pattern: table list + modal form, no routing changes. No hard-delete (API has no DELETE endpoints); deactivation uses PATCH with `state: "INACTIVE"` or `state: "ARCHIVED"`. A shared `OpsModal` component handles all modals. The sidebar nav gains a `/projects` link and an admin section (Cities, CMC, Routes, Nodes, Cameras, Users) visible only to ADMIN and SUPER_ADMIN roles.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS (ops-* colours), existing `apiGet/apiPost/apiPatch` from `lib/api.ts` (no new packages needed, no `apiDelete` required).

## Global Constraints

- No new npm packages
- TypeScript: 0 errors (`cd apps/web && npx tsc --noEmit`)
- git author: `leoa7x` / `leo.sanchez@thecicorp.com`
- All pages: `"use client"`, wrapped in `OpsShell` from `../../components/ops-shell` (or `../../../` from admin subdirectory)
- All API calls use `apiGet/apiPost/apiPatch` from the appropriate relative path to `lib/api`
- `useAuth()` from auth-provider supplies `accessToken: string | null`
- No hard delete — deactivate via `apiPatch` with `{ state: "INACTIVE" }` or `{ state: "ARCHIVED" }`
- Admin pages (`/admin/*`) go in `apps/web/app/admin/<name>/page.tsx`; import paths are `"../../../components/..."` and `"../../../lib/..."`
- Input CSS class (use verbatim in every form input/select/textarea): `"w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none"`
- Button CSS — primary: `"rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50"` · secondary: `"rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text"` · danger: `"rounded-ops border border-ops-rose/30 px-3 py-1 text-[11px] text-ops-rose hover:bg-ops-rose/10"`
- Enum values (exact strings, use verbatim):
  - `EntityState`: ACTIVE, INACTIVE, ARCHIVED
  - `RouteType`: FIBER, WIRELESS, HYBRID
  - `NodeType`: SWITCH, CABINET, AMPLIFIER, SPLITTER, OTHER
  - `UserRole`: SUPER_ADMIN, ADMIN, SUPERVISOR, OPERATOR, TECHNICIAN, VIEWER
  - `ActivityType`: PREVENTIVE_MAINTENANCE, CORRECTIVE_MAINTENANCE, INSPECTION, INSTALLATION, CONFIGURATION, OTHER
  - `EntryResult`: SATISFACTORY, PARTIAL, FAILED, PENDING

---

## File Map

```
apps/web/
  components/ops-modal.tsx             CREATE — shared modal wrapper
  components/ops-shell.tsx             MODIFY — add /projects to nav + admin section
  app/projects/page.tsx                MODIFY — add create/edit modals
  app/admin/cities/page.tsx            CREATE — City CRUD
  app/admin/centers/page.tsx           CREATE — MonitoringCenter CRUD
  app/admin/routes/page.tsx            CREATE — Route CRUD
  app/admin/nodes/page.tsx             CREATE — Node CRUD
  app/admin/cameras/page.tsx           CREATE — Camera CRUD
  app/admin/users/page.tsx             CREATE — User CRUD
  app/logbook/page.tsx                 MODIFY — add "Nueva entrada" form
```

---

## Task 1: OpsModal + Nav update

**Files:**
- Create: `apps/web/components/ops-modal.tsx`
- Modify: `apps/web/components/ops-shell.tsx`

**Interfaces:**
- Produces: `OpsModal` named export used by all subsequent tasks
- Produces: `/projects` visible in main nav; admin section visible to ADMIN/SUPER_ADMIN

---

- [ ] **Step 1: Create `apps/web/components/ops-modal.tsx`**

```tsx
"use client";

import { ReactNode, useEffect } from "react";

export function OpsModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-ops border border-ops-border bg-ops-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ops-border px-5 py-4">
          <h2 className="font-semibold text-ops-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ops-muted hover:text-ops-text"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `apps/web/components/ops-shell.tsx`**

In ops-shell.tsx, add the `ADMIN_NAV` array after the existing `NAV` array, and add `/projects` to `NAV`:

Replace the existing `NAV` constant:
```typescript
const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: "⬡" },
  { href: "/map",        label: "Mapa GIS",    icon: "◈" },
  { href: "/topology",   label: "Topología",   icon: "◫" },
  { href: "/projects",   label: "Proyectos",   icon: "◧" },
  { href: "/incidents",  label: "Incidentes",  icon: "⚠" },
  { href: "/logbook",    label: "Bitácora",    icon: "≡" },
];

const ADMIN_NAV = [
  { href: "/admin/cities",   label: "Ciudades",  icon: "○" },
  { href: "/admin/centers",  label: "CMC",       icon: "◎" },
  { href: "/admin/routes",   label: "Rutas",     icon: "⌥" },
  { href: "/admin/nodes",    label: "Nodos",     icon: "◉" },
  { href: "/admin/cameras",  label: "Cámaras",   icon: "⊙" },
  { href: "/admin/users",    label: "Usuarios",  icon: "⊕" },
];
```

In the `<nav>` section (after the existing `{NAV.map(...)}` block), add the admin section. The full `<nav>` element should become:

```tsx
<nav className="flex-1 space-y-1 px-3 py-4">
  {NAV.map((item) => {
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-ops px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-ops-blue/10 text-ops-blue shadow-ops-glow-blue"
            : "text-ops-muted hover:bg-ops-surface hover:text-ops-text"
        }`}
      >
        <span className="font-mono text-base leading-none">{item.icon}</span>
        {item.label}
      </Link>
    );
  })}

  {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
    <>
      <p className="px-3 pb-1 pt-4 text-[9px] font-bold uppercase tracking-widest text-ops-dim">
        Administración
      </p>
      {ADMIN_NAV.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-ops px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-ops-blue/10 text-ops-blue shadow-ops-glow-blue"
                : "text-ops-muted hover:bg-ops-surface hover:text-ops-text"
            }`}
          >
            <span className="font-mono text-base leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </>
  )}
</nav>
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/components/ops-modal.tsx apps/web/components/ops-shell.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add OpsModal component and admin nav links"
```

---

## Task 2: City CRUD (`/admin/cities`)

**Files:**
- Create: `apps/web/app/admin/cities/page.tsx`

**Interfaces:**
- Consumes: `GET /cities` → `CityItem[]`, `POST /cities` `{ name, department }`, `PATCH /cities/:id` `{ name?, department?, state? }`
- Produces: `/admin/cities` page, visible in admin nav

---

- [ ] **Step 1: Create `apps/web/app/admin/cities/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CityItem = { id: string; name: string; department: string; state: string };
type CityForm = { name: string; department: string };
const EMPTY: CityForm = { name: "", department: "" };
const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function CitiesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);
  const [form, setForm] = useState<CityForm>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try { setItems(await apiGet<CityItem[]>("/cities", accessToken)); }
    catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setModalOpen(true); }
  function openEdit(item: CityItem) {
    setEditing(item);
    setForm({ name: item.name, department: item.department });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) { await apiPatch(`/cities/${editing.id}`, accessToken, form); }
      else { await apiPost("/cities", accessToken, form); }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  async function toggleState(item: CityItem) {
    if (!accessToken) return;
    const next = item.state === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { await apiPatch(`/cities/${item.id}`, accessToken, { state: next }); await load(); }
    catch (err) { console.error(err); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Ciudades">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} ciudades</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nueva ciudad
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
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-medium text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.department}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {item.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="mr-3 text-[11px] text-ops-blue hover:underline">Editar</button>
                    <button onClick={() => toggleState(item)} className="text-[11px] text-ops-muted hover:text-ops-amber">
                      {item.state === "ACTIVE" ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar ciudad" : "Nueva ciudad"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Puerto Gaitán" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Departamento</label>
            <input className={INPUT} value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} required placeholder="Meta" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/cities/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add cities admin CRUD page"
```

---

## Task 3: Projects CRUD (enhance `/projects`)

**Files:**
- Modify: `apps/web/app/projects/page.tsx`

**Interfaces:**
- Consumes (additional): `GET /cities` → `{id, name}[]` for cityId dropdown, `POST /projects`, `PATCH /projects/:id`
- `CreateProjectDto`: `{ name, client, contract?, startDate (ISO date string), cityId }`
- `UpdateProjectDto`: `{ name?, client?, contract?, endDate?, state? }` (cityId and startDate cannot be updated)

---

- [ ] **Step 1: Rewrite `apps/web/app/projects/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsModal } from "../../components/ops-modal";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../lib/api";

type Project = {
  id: string; name: string; client: string; contract: string | null;
  state: string; startDate: string;
  city: { id: string; name: string; department: string };
  _count: { centers: number };
};
type CityRef = { id: string; name: string; department: string };
type CreateForm = { name: string; client: string; contract: string; startDate: string; cityId: string };
type EditForm = { name: string; client: string; contract: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const STATE_COLOR: Record<string, string> = {
  ACTIVE:   "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  INACTIVE: "text-ops-muted border-ops-dim bg-ops-surface",
  ARCHIVED: "text-ops-dim border-ops-dim bg-ops-surface",
};

export default function ProjectsPage() {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cities, setCities] = useState<CityRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", client: "", contract: "", startDate: "", cityId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", client: "", contract: "", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        apiGet<Project[]>("/projects", accessToken),
        apiGet<CityRef[]>("/cities", accessToken),
      ]);
      setProjects(p);
      setCities(c);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ name: "", client: "", contract: "", startDate: "", cityId: cities[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(p: Project) {
    setEditing(p);
    setEditForm({ name: p.name, client: p.client, contract: p.contract ?? "", state: p.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/projects/${editing.id}`, accessToken, {
          name: editForm.name, client: editForm.client,
          contract: editForm.contract || undefined, state: editForm.state,
        });
      } else {
        await apiPost("/projects", accessToken, {
          name: createForm.name, client: createForm.client,
          contract: createForm.contract || undefined,
          startDate: new Date(createForm.startDate).toISOString(),
          cityId: createForm.cityId,
        });
      }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Estructura" title="Proyectos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{projects.length} proyectos</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo proyecto
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-ops border border-ops-border bg-ops-panel py-16 text-center text-sm text-ops-muted">
          No hay proyectos. Crea el primero.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops transition hover:border-ops-blue/30">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${STATE_COLOR[p.state] ?? ""}`}>
                  {p.state}
                </span>
                <p className="text-right text-[10px] text-ops-dim">
                  {new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(new Date(p.startDate))}
                </p>
              </div>
              <h3 className="text-sm font-semibold text-ops-text">{p.name}</h3>
              <p className="mt-0.5 text-[11px] text-ops-muted">{p.client}</p>
              {p.contract && <p className="mt-0.5 font-mono text-[10px] text-ops-dim">{p.contract}</p>}
              <div className="mt-3 flex items-center justify-between border-t border-ops-border pt-3">
                <p className="text-[11px] text-ops-muted">{p.city.name}, {p.city.department}</p>
                <button onClick={() => openEdit(p)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar proyecto" : "Nuevo proyecto"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Sistema CCTV Puerto Gaitán" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Cliente</label>
                <input className={INPUT} value={createForm.client} onChange={(e) => setCreateForm((f) => ({ ...f, client: e.target.value }))} required placeholder="Alcaldía de Puerto Gaitán" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contrato (opcional)</label>
                <input className={INPUT} value={createForm.contract} onChange={(e) => setCreateForm((f) => ({ ...f, contract: e.target.value }))} placeholder="1445-2024" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Fecha inicio</label>
                <input type="date" className={INPUT} value={createForm.startDate} onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ciudad</label>
                <select className={INPUT} value={createForm.cityId} onChange={(e) => setCreateForm((f) => ({ ...f, cityId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.department}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
                <input className={INPUT} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Cliente</label>
                <input className={INPUT} value={editForm.client} onChange={(e) => setEditForm((f) => ({ ...f, client: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contrato</label>
                <input className={INPUT} value={editForm.contract} onChange={(e) => setEditForm((f) => ({ ...f, contract: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
                <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
            </>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/projects/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add create/edit to projects page"
```

---

## Task 4: CMC CRUD (`/admin/centers`)

**Files:**
- Create: `apps/web/app/admin/centers/page.tsx`

**Interfaces:**
- Consumes: `GET /monitoring-centers` → `CenterItem[]`, `GET /projects` → `{id, name}[]`, `POST /monitoring-centers`, `PATCH /monitoring-centers/:id`
- `CreateCenterDto`: `{ name, address?, projectId }`
- `UpdateCenterDto`: `{ name?, address?, state? }`

---

- [ ] **Step 1: Create `apps/web/app/admin/centers/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CenterItem = {
  id: string; name: string; address: string | null; state: string;
  project: { id: string; name: string; city: { name: string } };
  _count: { routes: number };
};
type ProjectRef = { id: string; name: string };
type CreateForm = { name: string; address: string; projectId: string };
type EditForm = { name: string; address: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function CentersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CenterItem[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CenterItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ name: "", address: "", projectId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", address: "", state: "ACTIVE" });
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
    setCreateForm({ name: "", address: "", projectId: projects[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: CenterItem) {
    setEditing(item);
    setEditForm({ name: item.name, address: item.address ?? "", state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/monitoring-centers/${editing.id}`, accessToken, {
          name: editForm.name, address: editForm.address || undefined, state: editForm.state,
        });
      } else {
        await apiPost("/monitoring-centers", accessToken, {
          name: createForm.name, address: createForm.address || undefined, projectId: createForm.projectId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Centros de Monitoreo (CMC)">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} centros</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nuevo CMC
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Proyecto / Ciudad</th>
                <th className="px-4 py-3">Rutas</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-medium text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.project.name} · {item.project.city.name}</td>
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
      <OpsModal open={modalOpen} title={editing ? "Editar CMC" : "Nuevo CMC"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="CMC Central" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Dirección (opcional)</label>
            <input className={INPUT} value={editing ? editForm.address : createForm.address}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, address: e.target.value })) : setCreateForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Calle 1 # 2-3" />
          </div>
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Proyecto</label>
              <select className={INPUT} value={createForm.projectId} onChange={(e) => setCreateForm((f) => ({ ...f, projectId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/centers/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add CMC admin CRUD page"
```

---

## Task 5: Routes CRUD (`/admin/routes`)

**Files:**
- Create: `apps/web/app/admin/routes/page.tsx`

**Interfaces:**
- Consumes: `GET /routes` → `RouteItem[]`, `GET /monitoring-centers` → `{id, name}[]`, `POST /routes`, `PATCH /routes/:id`
- `CreateRouteDto`: `{ identifier, type: RouteType, monitoringCenterId }`
- `UpdateRouteDto`: `{ identifier?, type?, state? }`
- `RouteType` values: `FIBER`, `WIRELESS`, `HYBRID`

---

- [ ] **Step 1: Create `apps/web/app/admin/routes/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type RouteItem = {
  id: string; identifier: string; type: string; state: string;
  center: { id: string; name: string };
  _count: { nodes: number };
};
type CenterRef = { id: string; name: string };
type CreateForm = { identifier: string; type: string; monitoringCenterId: string };
type EditForm = { identifier: string; type: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const ROUTE_TYPES = ["FIBER", "WIRELESS", "HYBRID"];

export default function RoutesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<RouteItem[]>([]);
  const [centers, setCenters] = useState<CenterRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RouteItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ identifier: "", type: "FIBER", monitoringCenterId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ identifier: "", type: "FIBER", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        apiGet<RouteItem[]>("/routes", accessToken),
        apiGet<CenterRef[]>("/monitoring-centers", accessToken),
      ]);
      setItems(r); setCenters(c);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ identifier: "", type: "FIBER", monitoringCenterId: centers[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: RouteItem) {
    setEditing(item);
    setEditForm({ identifier: item.identifier, type: item.type, state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) { await apiPatch(`/routes/${editing.id}`, accessToken, editForm); }
      else { await apiPost("/routes", accessToken, createForm); }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Rutas">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} rutas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nueva ruta</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Identificador</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">CMC</th>
                <th className="px-4 py-3">Nodos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-mono text-sm text-ops-text">{item.identifier}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.type}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.center.name}</td>
                  <td className="px-4 py-3 tabular-nums text-ops-muted">{item._count.nodes}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>{item.state}</span>
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
      <OpsModal open={modalOpen} title={editing ? "Editar ruta" : "Nueva ruta"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Identificador</label>
            <input className={INPUT} value={editing ? editForm.identifier : createForm.identifier}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, identifier: e.target.value })) : setCreateForm((f) => ({ ...f, identifier: e.target.value }))}
              required placeholder="RUTA-001" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
            <select className={INPUT} value={editing ? editForm.type : createForm.type}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, type: e.target.value })) : setCreateForm((f) => ({ ...f, type: e.target.value }))}>
              {ROUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">CMC</label>
              <select className={INPUT} value={createForm.monitoringCenterId} onChange={(e) => setCreateForm((f) => ({ ...f, monitoringCenterId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/routes/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add routes admin CRUD page"
```

---

## Task 6: Nodes CRUD (`/admin/nodes`)

**Files:**
- Create: `apps/web/app/admin/nodes/page.tsx`

**Interfaces:**
- Consumes: `GET /nodes` → `NodeItem[]`, `GET /routes` → `{id, identifier, center.name}[]`, `POST /nodes`, `PATCH /nodes/:id`
- `CreateNodeDto`: `{ code, name, lat: 0, lng: 0, ip?, mac?, nodeType?, snmpCommunity?, routeId }`
- `UpdateNodeDto`: `{ name?, ip?, mac?, nodeType?, snmpCommunity?, operativeState? }`
- `NodeType` values: `SWITCH`, `CABINET`, `AMPLIFIER`, `SPLITTER`, `OTHER`
- lat and lng default to 0 on create — coordinates are set later via the map page

---

- [ ] **Step 1: Create `apps/web/app/admin/nodes/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type NodeItem = {
  id: string; code: string; name: string; ip: string | null;
  nodeType: string; operativeState: string;
  route: { id: string; identifier: string; center: { name: string } };
};
type RouteRef = { id: string; identifier: string; center: { name: string } };
type CreateForm = { code: string; name: string; ip: string; mac: string; nodeType: string; snmpCommunity: string; routeId: string };
type EditForm = { name: string; ip: string; mac: string; nodeType: string; snmpCommunity: string; operativeState: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const NODE_TYPES = ["SWITCH", "CABINET", "AMPLIFIER", "SPLITTER", "OTHER"];
const NODE_STATES = ["ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"];

const STATE_COLOR: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

export default function NodesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<NodeItem[]>([]);
  const [routes, setRoutes] = useState<RouteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NodeItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ code: "", name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", routeId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", operativeState: "ONLINE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [n, r] = await Promise.all([
        apiGet<NodeItem[]>("/nodes", accessToken),
        apiGet<RouteRef[]>("/routes", accessToken),
      ]);
      setItems(n); setRoutes(r);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ code: "", name: "", ip: "", mac: "", nodeType: "SWITCH", snmpCommunity: "", routeId: routes[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: NodeItem) {
    setEditing(item);
    setEditForm({ name: item.name, ip: item.ip ?? "", mac: "", nodeType: item.nodeType, snmpCommunity: "", operativeState: item.operativeState });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/nodes/${editing.id}`, accessToken, {
          name: editForm.name, ip: editForm.ip || undefined,
          mac: editForm.mac || undefined, nodeType: editForm.nodeType,
          snmpCommunity: editForm.snmpCommunity || undefined,
          operativeState: editForm.operativeState,
        });
      } else {
        await apiPost("/nodes", accessToken, {
          code: createForm.code, name: createForm.name, lat: 0, lng: 0,
          ip: createForm.ip || undefined, mac: createForm.mac || undefined,
          nodeType: createForm.nodeType,
          snmpCommunity: createForm.snmpCommunity || undefined,
          routeId: createForm.routeId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Nodos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} nodos · Las coordenadas se asignan en la página Mapa</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nuevo nodo</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="px-4 py-3 hidden md:table-cell">IP</th>
                <th className="px-4 py-3 hidden md:table-cell">Ruta / CMC</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[item.operativeState] ?? STATE_COLOR.MAINTENANCE}`}>
                      {item.operativeState}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-text">{item.code}</td>
                  <td className="px-4 py-3 text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-ops-muted">{item.nodeType}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-ops-dim">{item.ip ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-[11px] text-ops-muted">{item.route.identifier} · {item.route.center.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsModal open={modalOpen} title={editing ? `Editar ${editing.code}` : "Nuevo nodo"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código (único)</label>
              <input className={INPUT} value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} required placeholder="NODE-001" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="Cámara Parque Central" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
              <select className={INPUT} value={editing ? editForm.nodeType : createForm.nodeType}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, nodeType: e.target.value })) : setCreateForm((f) => ({ ...f, nodeType: e.target.value }))}>
                {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP (opcional)</label>
              <input className={INPUT} value={editing ? editForm.ip : createForm.ip}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, ip: e.target.value })) : setCreateForm((f) => ({ ...f, ip: e.target.value }))}
                placeholder="192.168.1.10" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">SNMP Community (opcional)</label>
            <input className={INPUT} value={editing ? editForm.snmpCommunity : createForm.snmpCommunity}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, snmpCommunity: e.target.value })) : setCreateForm((f) => ({ ...f, snmpCommunity: e.target.value }))}
              placeholder="public" />
          </div>
          {!editing ? (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta</label>
              <select className={INPUT} value={createForm.routeId} onChange={(e) => setCreateForm((f) => ({ ...f, routeId: e.target.value }))} required>
                <option value="">Seleccionar…</option>
                {routes.map((r) => <option key={r.id} value={r.id}>{r.identifier} — {r.center.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado operativo</label>
              <select className={INPUT} value={editForm.operativeState} onChange={(e) => setEditForm((f) => ({ ...f, operativeState: e.target.value }))}>
                {NODE_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <p className="text-[10px] text-ops-dim">Las coordenadas (lat/lng) se asignan desde la página Mapa → botón Ubicar.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/nodes/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add nodes admin CRUD page"
```

---

## Task 7: Cameras CRUD (`/admin/cameras`)

**Files:**
- Create: `apps/web/app/admin/cameras/page.tsx`

**Interfaces:**
- Consumes: `GET /cameras` → `CameraItem[]`, `GET /nodes` → `{id, code, name}[]`, `POST /cameras`, `PATCH /cameras/:id`
- `CreateCameraDto`: `{ code, name, ip?, brand?, model?, resolution?, hasAnalytics?, nodeId }`
- `UpdateCameraDto`: `{ name?, ip?, state?, hasAnalytics? }`
- `CameraState` values: `ONLINE`, `OFFLINE`, `DEGRADED`, `MAINTENANCE`

---

- [ ] **Step 1: Create `apps/web/app/admin/cameras/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type CameraItem = {
  id: string; code: string; name: string; ip: string | null;
  brand: string | null; model: string | null; state: string; hasAnalytics: boolean;
  node: { id: string; code: string; name: string };
};
type NodeRef = { id: string; code: string; name: string };
type CreateForm = { code: string; name: string; ip: string; brand: string; model: string; resolution: string; hasAnalytics: boolean; nodeId: string };
type EditForm = { name: string; ip: string; hasAnalytics: boolean; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const CAM_STATES = ["ONLINE", "OFFLINE", "DEGRADED", "MAINTENANCE"];
const STATE_COLOR: Record<string, string> = {
  ONLINE: "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  DEGRADED: "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OFFLINE: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  MAINTENANCE: "border-ops-border bg-ops-surface text-ops-muted",
};

export default function CamerasPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CameraItem[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CameraItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ code: "", name: "", ip: "", brand: "", model: "", resolution: "", hasAnalytics: false, nodeId: "" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", ip: "", hasAnalytics: false, state: "ONLINE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [c, n] = await Promise.all([
        apiGet<CameraItem[]>("/cameras", accessToken),
        apiGet<NodeRef[]>("/nodes", accessToken),
      ]);
      setItems(c); setNodes(n);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ code: "", name: "", ip: "", brand: "", model: "", resolution: "", hasAnalytics: false, nodeId: nodes[0]?.id ?? "" });
    setModalOpen(true);
  }
  function openEdit(item: CameraItem) {
    setEditing(item);
    setEditForm({ name: item.name, ip: item.ip ?? "", hasAnalytics: item.hasAnalytics, state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/cameras/${editing.id}`, accessToken, {
          name: editForm.name, ip: editForm.ip || undefined,
          hasAnalytics: editForm.hasAnalytics, state: editForm.state,
        });
      } else {
        await apiPost("/cameras", accessToken, {
          code: createForm.code, name: createForm.name,
          ip: createForm.ip || undefined, brand: createForm.brand || undefined,
          model: createForm.model || undefined, resolution: createForm.resolution || undefined,
          hasAnalytics: createForm.hasAnalytics, nodeId: createForm.nodeId,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Cámaras">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} cámaras</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nueva cámara</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Nodo</th>
                <th className="px-4 py-3 hidden md:table-cell">IP</th>
                <th className="px-4 py-3 hidden md:table-cell">Analítica</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${STATE_COLOR[item.state] ?? STATE_COLOR.MAINTENANCE}`}>{item.state}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-text">{item.code}</td>
                  <td className="px-4 py-3 text-ops-text">{item.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[11px] text-ops-muted">{item.node.code}</td>
                  <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-ops-dim">{item.ip ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ops-muted">{item.hasAnalytics ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OpsModal open={modalOpen} title={editing ? `Editar ${editing.code}` : "Nueva cámara"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código (único)</label>
              <input className={INPUT} value={createForm.code} onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))} required placeholder="CAM-001" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required placeholder="Cámara Esquina Norte" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">IP (opcional)</label>
            <input className={INPUT} value={editing ? editForm.ip : createForm.ip}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, ip: e.target.value })) : setCreateForm((f) => ({ ...f, ip: e.target.value }))}
              placeholder="192.168.1.20" />
          </div>
          {!editing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Marca</label>
                  <input className={INPUT} value={createForm.brand} onChange={(e) => setCreateForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Dahua" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Modelo</label>
                  <input className={INPUT} value={createForm.model} onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))} placeholder="IPC-HDW2831T" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nodo</label>
                <select className={INPUT} value={createForm.nodeId} onChange={(e) => setCreateForm((f) => ({ ...f, nodeId: e.target.value }))} required>
                  <option value="">Seleccionar…</option>
                  {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name}</option>)}
                </select>
              </div>
            </>
          )}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                {CAM_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ops-muted">
            <input type="checkbox" checked={editing ? editForm.hasAnalytics : createForm.hasAnalytics}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, hasAnalytics: e.target.checked })) : setCreateForm((f) => ({ ...f, hasAnalytics: e.target.checked }))}
              className="rounded" />
            Tiene analítica de video
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/cameras/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add cameras admin CRUD page"
```

---

## Task 8: Logbook — add "Nueva entrada" form

**Files:**
- Modify: `apps/web/app/logbook/page.tsx`

**Interfaces:**
- Consumes (additional): `GET /nodes` → `{id, code, name}[]`, `GET /users` → `{id, name, email, role}[]`, `POST /logbook`
- `CreateLogbookEntryDto`: `{ activityType, observations?, result, technicianId, nodeId }`
- `ActivityType` values: `PREVENTIVE_MAINTENANCE`, `CORRECTIVE_MAINTENANCE`, `INSPECTION`, `INSTALLATION`, `CONFIGURATION`, `OTHER`
- `EntryResult` values: `SATISFACTORY`, `PARTIAL`, `FAILED`, `PENDING`

---

- [ ] **Step 1: Read the current logbook page**

Read `apps/web/app/logbook/page.tsx` in full before making changes.

- [ ] **Step 2: Rewrite `apps/web/app/logbook/page.tsx`**

Keep the existing list rendering intact. Add imports for `OpsModal`, `apiPost`, `useState` for form, and the form UI. The full replacement:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { OpsModal } from "../../components/ops-modal";
import { useAuth } from "../../components/auth-provider";
import { apiGet, apiPost } from "../../lib/api";

type Entry = {
  id: string; date: string; activityType: string; observations: string | null; result: string;
  technician: { name: string | null; email: string };
  node: { code: string; name: string };
};
type NodeRef = { id: string; code: string; name: string };
type UserRef = { id: string; name: string | null; email: string; role: string };
type CreateForm = { activityType: string; observations: string; result: string; technicianId: string; nodeId: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const RESULT_COLOR: Record<string, string> = {
  SATISFACTORY: "text-ops-emerald border-ops-emerald/30 bg-ops-emerald/10",
  PARTIAL:      "text-ops-amber border-ops-amber/30 bg-ops-amber/10",
  FAILED:       "text-ops-rose border-ops-rose/30 bg-ops-rose/10",
  PENDING:      "text-ops-muted border-ops-dim bg-ops-surface",
};

const ACTIVITY_LABELS: Record<string, string> = {
  PREVENTIVE_MAINTENANCE: "Mant. Preventivo",
  CORRECTIVE_MAINTENANCE: "Mant. Correctivo",
  INSPECTION: "Inspección",
  INSTALLATION: "Instalación",
  CONFIGURATION: "Configuración",
  OTHER: "Otro",
};

export default function LogbookPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CreateForm>({ activityType: "INSPECTION", observations: "", result: "SATISFACTORY", technicianId: "", nodeId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [e, n, u] = await Promise.all([
        apiGet<Entry[]>("/logbook", accessToken),
        apiGet<NodeRef[]>("/nodes", accessToken),
        apiGet<UserRef[]>("/users", accessToken),
      ]);
      setEntries(e); setNodes(n); setUsers(u);
    } catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ activityType: "INSPECTION", observations: "", result: "SATISFACTORY", technicianId: users[0]?.id ?? "", nodeId: nodes[0]?.id ?? "" });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      await apiPost("/logbook", accessToken, { ...form, observations: form.observations || undefined });
      setModalOpen(false);
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Operaciones" title="Bitácora">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{entries.length} entradas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nueva entrada
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : entries.length === 0 ? (
        <div className="rounded-ops border border-ops-border bg-ops-panel py-16 text-center text-sm text-ops-muted">No hay entradas en la bitácora.</div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Actividad</th>
                <th className="px-4 py-3">Nodo</th>
                <th className="px-4 py-3 hidden sm:table-cell">Técnico</th>
                <th className="px-4 py-3">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 text-[11px] text-ops-muted">
                    {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.date))}
                  </td>
                  <td className="px-4 py-3 text-ops-text">{ACTIVITY_LABELS[entry.activityType] ?? entry.activityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ops-muted">{entry.node.code}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-[11px] text-ops-muted">{entry.technician.name ?? entry.technician.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${RESULT_COLOR[entry.result] ?? ""}`}>{entry.result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title="Nueva entrada de bitácora" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo de actividad</label>
            <select className={INPUT} value={form.activityType} onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}>
              {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Resultado</label>
            <select className={INPUT} value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}>
              {["SATISFACTORY", "PARTIAL", "FAILED", "PENDING"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nodo</label>
            <select className={INPUT} value={form.nodeId} onChange={(e) => setForm((f) => ({ ...f, nodeId: e.target.value }))} required>
              <option value="">Seleccionar…</option>
              {nodes.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Técnico</label>
            <select className={INPUT} value={form.technicianId} onChange={(e) => setForm((f) => ({ ...f, technicianId: e.target.value }))} required>
              <option value="">Seleccionar…</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email} ({u.role})</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Observaciones (opcional)</label>
            <textarea className={INPUT} rows={3} value={form.observations} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} placeholder="Descripción del trabajo realizado…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 3: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/logbook/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add create entry form to logbook page"
```

---

## Task 9: User management (`/admin/users`)

**Files:**
- Create: `apps/web/app/admin/users/page.tsx`

**Interfaces:**
- Consumes: `GET /users` → `UserItem[]`, `POST /users`, `PATCH /users/:id`
- `CreateUserDto`: `{ email, password (min 8 chars), name?, role: UserRole }`
- `UpdateUserDto`: `{ name?, role?, state? }` — password is NOT updatable via PATCH
- `UserRole` values: `SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`, `OPERATOR`, `TECHNICIAN`, `VIEWER`

---

- [ ] **Step 1: Create `apps/web/app/admin/users/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";

type UserItem = { id: string; email: string; name: string | null; role: string; state: string; createdAt: string };
type CreateForm = { email: string; password: string; name: string; role: string };
type EditForm = { name: string; role: string; state: string };

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";
const ROLES = ["SUPER_ADMIN", "ADMIN", "SUPERVISOR", "OPERATOR", "TECHNICIAN", "VIEWER"];

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "border-ops-rose/30 bg-ops-rose/10 text-ops-rose",
  ADMIN:       "border-ops-blue/30 bg-ops-blue/10 text-ops-blue",
  SUPERVISOR:  "border-ops-amber/30 bg-ops-amber/10 text-ops-amber",
  OPERATOR:    "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald",
  TECHNICIAN:  "border-ops-border bg-ops-surface text-ops-muted",
  VIEWER:      "border-ops-border bg-ops-surface text-ops-dim",
};

export default function UsersPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({ email: "", password: "", name: "", role: "OPERATOR" });
  const [editForm, setEditForm] = useState<EditForm>({ name: "", role: "OPERATOR", state: "ACTIVE" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try { setItems(await apiGet<UserItem[]>("/users", accessToken)); }
    catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm({ email: "", password: "", name: "", role: "OPERATOR" });
    setModalOpen(true);
  }
  function openEdit(item: UserItem) {
    setEditing(item);
    setEditForm({ name: item.name ?? "", role: item.role, state: item.state });
    setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      if (editing) {
        await apiPatch(`/users/${editing.id}`, accessToken, {
          name: editForm.name || undefined, role: editForm.role, state: editForm.state,
        });
      } else {
        await apiPost("/users", accessToken, {
          email: createForm.email, password: createForm.password,
          name: createForm.name || undefined, role: createForm.role,
        });
      }
      closeModal(); await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <OpsShell eyebrow="Administración" title="Usuarios">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} usuarios</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">+ Nuevo usuario</button>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" /></div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3 font-medium text-ops-text">{item.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ops-muted">{item.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase ${ROLE_COLOR[item.role] ?? ""}`}>{item.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>{item.state}</span>
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
      <OpsModal open={modalOpen} title={editing ? "Editar usuario" : "Nuevo usuario"} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Email</label>
                <input type="email" className={INPUT} value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required placeholder="operador@municipio.gov.co" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Contraseña (mín. 8 caracteres)</label>
                <input type="password" className={INPUT} value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nombre (opcional)</label>
            <input className={INPUT} value={editing ? editForm.name : createForm.name}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Juan Pérez" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Rol</label>
            <select className={INPUT} value={editing ? editForm.role : createForm.role}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, role: e.target.value })) : setCreateForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript + commit**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/users/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add user management admin page"
```

---

## Task 10: Push

**Files:** No new files.

---

- [ ] **Step 1: Final TypeScript check**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1 && echo "WEB OK"
```

Expected: `WEB OK` with no errors.

- [ ] **Step 2: Push**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV push origin HEAD
```

- [ ] **Step 3: Verify**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV log --oneline origin/main -10
```

Expected: top commits include all Plan 6 feat commits.
