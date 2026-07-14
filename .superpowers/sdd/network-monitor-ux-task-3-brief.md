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
