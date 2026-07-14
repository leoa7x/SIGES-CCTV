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
