# Network Monitor UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `/monitoring/network` into a professional analyst-style NOC dashboard with premium corporate visual hierarchy while preserving the existing SIGES monitoring behavior.

**Architecture:** Keep all current data loading, embeds, inventory correlation, discovery, and alert logic intact. Concentrate the refresh in `apps/web/app/monitoring/network/page.tsx`, using small presentational cleanups inside the page and only minimal helper updates where tests or derived chart inputs need adjustment.

**Tech Stack:** Next.js 15 App Router, React client components, TypeScript, Tailwind utility styling, existing SIGES Grafana embed contract.

## Global Constraints

- No cambiar la lógica de negocio de discovery, inventario, correlación ni alertas.
- No reemplazar modelos SIGES por datos crudos de Grafana.
- No mover rutas, puertos ni flujos de autenticación.
- No rediseñar otras pantallas administrativas en esta fase.
- Base funcional: `Analyst`.
- Capa visual: `premium corporativo`.
- Paleta dominante: `azul acero + cian`.
- Fondo base: grafito profundo.
- El bloque global de Grafana debe ir arriba, inmediatamente debajo del hero, como superficie principal de observabilidad.
- `OpsShell` no debe ser rediseñado por completo en esta fase.
- No cambiar rutas ni navegación.
- No cambiar comportamiento de auth.
- No cambiar contratos de `apiGet`, embeds ni telemetry helpers.
- SIGES sigue siendo dueño de inventario correlacionado, discovery, alerts modeladas en aplicación y detalle operativo por nodo.
- Grafana sigue siendo solo la capa de visualización embebida para observabilidad global y por nodo.
- La implementación debe verificar como mínimo `npm run test:network-monitor --workspace=apps/web` y `npm run build --workspace=apps/web`.

---

### Task 1: Refresh Hero And Global Grafana Hierarchy

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Test: `apps/web/lib/network-monitor.test.ts`

**Interfaces:**
- Consumes:
  - `buildNetworkMonitorModel(nodes, detail): NetworkMonitorModel`
  - `buildGrafanaEmbedModel(descriptor: GrafanaEmbedDescriptor): GrafanaEmbedModel`
  - `GrafanaPanelEmbed({ title, src, loading })`
- Produces:
  - A top-of-page hero section with premium KPI hierarchy
  - A top-positioned global Grafana block visually anchored under the hero

- [ ] **Step 1: Review the current page structure and identify the hero/Grafana render block**

Read:

```ts
// apps/web/app/monitoring/network/page.tsx
<OpsShell eyebrow="Centro de Operaciones" title="Monitoreo de Red">
  <div className="space-y-6">
    ...
    <GrafanaPanelEmbed ... />
```

Expected: Confirm the current top section, KPI cards, and Grafana block location.

- [ ] **Step 2: Write the intended layout sketch inside the task notes before editing**

Target structure:

```tsx
<OpsShell eyebrow="Centro de Operaciones" title="Monitoreo de Red">
  <div className="space-y-8">
    <section>{/* premium hero */}</section>
    <section>{/* anchored global grafana */}</section>
    <section>{/* workspace operativo */}</section>
  </div>
</OpsShell>
```

Expected: The implementer uses this hierarchy while preserving existing data usage.

- [ ] **Step 3: Update the hero section to use stronger typography, cleaner KPI grouping, and premium corporate spacing**

Implement directly in:

```tsx
// apps/web/app/monitoring/network/page.tsx
<section className="relative overflow-hidden rounded-[28px] border border-ops-border bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_top_right,rgba(37,99,235,0.18),transparent_35%),linear-gradient(135deg,#07111d,#0b1727_62%,#08131f)] p-6 shadow-ops">
  ...
</section>
```

Requirements:
- Preserve the current KPI meanings.
- Make the title/subtitle feel more premium and less widget-like.
- Keep 4-6 KPI summaries visible above the fold.

- [ ] **Step 4: Keep the global Grafana embed immediately below the hero and restyle its wrapper so it reads as a first-class observability surface**

Implement directly in:

```tsx
<section className="rounded-[26px] border border-ops-border bg-[linear-gradient(180deg,rgba(8,18,32,0.98),rgba(5,11,22,0.98))] p-4 shadow-ops">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Observabilidad Global</p>
      <h2 className="mt-1 text-lg font-semibold text-ops-text">Comando de red y telemetría consolidada</h2>
    </div>
  </div>
  <GrafanaPanelEmbed ... />
</section>
```

Requirements:
- Keep the same embed descriptor source.
- Do not move Grafana below the workspace.
- Do not replace the embed with any custom chart.

- [ ] **Step 5: Run the focused monitor test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx apps/web/lib/network-monitor.test.ts
git commit -m "feat(web): refresh network monitor hero hierarchy"
```

### Task 2: Redesign Node Rail And Detail Header

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`

**Interfaces:**
- Consumes:
  - `filteredNodes`
  - `selectedNodeId`
  - `detail`
  - `stateBadge(state: string): string`
- Produces:
  - A more tactical left rail for node selection
  - A stronger operational header for the selected node

- [ ] **Step 1: Locate the current two-column workspace and preserve its data flow**

Read:

```tsx
<div className="grid gap-6 xl:grid-cols-[1fr_1.6fr] xl:items-start">
  <section>{/* left rail */}</section>
  <section>{/* node detail */}</section>
</div>
```

Expected: Confirm the refresh will keep the current left/right operational workflow.

- [ ] **Step 2: Restyle the left rail into a node command list with tighter hierarchy and clearer state signals**

Implement by editing the node list cards in:

```tsx
{filteredNodes.map((node) => (
  <button ...>
    <div>{/* code, name, route */}</div>
    <span>{node.operativeState}</span>
    <div>{/* assets, scans, analytics */}</div>
  </button>
))}
```

Requirements:
- Keep the current selection behavior.
- Make selected state more obvious.
- Compress secondary metadata so the rail scans faster visually.

- [ ] **Step 3: Redesign the selected-node header to feel more like a command surface**

Implement in the right-side header block:

```tsx
<div className={PANEL_HUD}>
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>{/* title, route, badges */}</div>
    <div>{/* discovery action + loading indicator */}</div>
  </div>
</div>
```

Requirements:
- Keep the discovery button as the primary action.
- Preserve the same detail data.
- Improve badge visual consistency and spacing.

- [ ] **Step 4: Keep tabs intact but improve their spacing and framing**

Maintain:

```tsx
tab: "inventario" | "trafico" | "alertas"
```

Requirements:
- Do not rename the tabs in state.
- Do not remove any current operational view.
- Give the tab row stronger separation from the header and content.

- [ ] **Step 5: Run the focused monitor test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx
git commit -m "feat(web): refresh network monitor workspace shell"
```

### Task 3: Upgrade Inventory, Traffic, And Alerts Presentation

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/network-monitor.test.ts`

**Interfaces:**
- Consumes:
  - `model.inventory`
  - `model.alerts`
  - `telemetrySummary`
  - `telemetryTimeseries`
  - `telemetryAssets`
  - `telemetryAlerts`
- Produces:
  - Better visual framing for inventory, traffic, and alert modules
  - Preserved logic with more consistent chart and module styling

- [ ] **Step 1: Preserve the existing tab content branches**

Keep:

```tsx
{tab === "inventario" && (...)}
{tab === "trafico" && (...)}
{tab === "alertas" && (...)}
```

Expected: No behavioral removal of current monitor surfaces.

- [ ] **Step 2: Refresh the inventory panel styling without changing its data model**

Edit the inventory table wrapper and surrounding cards.

Requirements:
- Keep existing filtering behavior.
- Keep official/discovery source labels.
- Make the inventory block feel like a polished operations module rather than a plain table panel.

- [ ] **Step 3: Refresh the traffic/telemetry section into a more coherent analyst surface**

Use the existing:

```tsx
TelemetryStrip
MiniBarChart
DiscoveryTrendChart
SignalMatrix
```

Requirements:
- Do not replace SIGES telemetry with Grafana data.
- Keep the current telemetry summaries and derived charts.
- Improve visual grouping, spacing, and hierarchy between telemetry summaries and detailed lists.

- [ ] **Step 4: Refresh the alert section so severity and actionability read faster**

Edit the alert cards and wrappers while keeping:

```ts
telemetryAlertLevel(severity)
model.alerts
telemetryAlerts
```

Requirements:
- Preserve severity semantics.
- Make critical and warning states more immediately scannable.
- Keep alert content dense enough for operations use.

- [ ] **Step 5: Extend or adjust monitor tests only if helper expectations changed**

If visual work changes helper-derived expectations, update the exact test blocks in:

```ts
// apps/web/lib/network-monitor.test.ts
test("buildNetworkMonitorModel ...")
test("buildNetworkMonitorModel reports missing IP, subnet and analytics as alerts", ...)
```

Expected: Only change tests if the helper contract actually changed; do not rewrite tests just because styling changed.

- [ ] **Step 6: Run the focused monitor test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

- [ ] **Step 7: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx apps/web/lib/network-monitor.test.ts
git commit -m "feat(web): polish network monitor modules"
```

### Task 4: Verify End-To-End Dev Screen Stability

**Files:**
- Modify: none required unless verification finds a defect

**Interfaces:**
- Consumes:
  - `/monitoring/network`
  - `/admin/nodes`
  - `GET /observability/embed/network-command-view`
  - `GET /observability/embed/node/:id`
- Produces:
  - Confirmed local development screen stability after the refresh

- [ ] **Step 1: Ensure API and web dev servers are running**

Run: `ss -lptn 'sport = :4001'`
Expected: API listener present

Run: `ss -lptn 'sport = :3001'`
Expected: web listener present

- [ ] **Step 2: Verify the web routes still answer successfully**

Run: `curl -I -s http://127.0.0.1:3001/admin/nodes`
Expected: `HTTP/1.1 200 OK`

Run: `curl -I -s http://127.0.0.1:3001/monitoring/network`
Expected: `HTTP/1.1 200 OK`

- [ ] **Step 3: Verify the global Grafana descriptor still resolves**

Run: `bash .superpowers/sdd/verify-grafana-embed.sh`
Expected:
- node embed JSON includes `dashboard`, `title`, and `var-nodeId`
- global embed JSON includes `dashboard`, `title`, and no `var-nodeId`
- both routes print `200` headers

- [ ] **Step 4: Commit only if a verification defect required a code fix**

```bash
git add -A
git commit -m "fix(web): stabilize network monitor refresh"
```

## Self-Review

### Spec Coverage

- Hero ejecutivo con métricas: covered by Task 1.
- Grafana global arriba como pieza protagonista: covered by Task 1 and Task 4 verification.
- Workspace operativo por nodo: covered by Task 2.
- Rail táctico de nodos y detalle operacional premium: covered by Task 2.
- Inventario, tráfico y alertas mejor jerarquizados sin cambiar lógica: covered by Task 3.
- Preservar contratos, auth, rutas, y ownership de datos SIGES: enforced across Global Constraints and every task.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Every task names exact files, commands, and preserved interfaces.
- Visual tasks intentionally avoid fake code snippets for purely stylistic internals beyond the exact render blocks they target.

### Type Consistency

- `GrafanaEmbedDescriptor`, `buildGrafanaEmbedModel`, `buildNetworkMonitorModel`, `tab`, and route paths are referenced consistently.
- No later task renames earlier state keys or dashboard identifiers.

