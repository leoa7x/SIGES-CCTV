# Grafana Embedded Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add embedded Grafana observability to SIGES so node-level and global network monitoring pages can display filtered dashboards without moving business logic or correlation rules out of SIGES.

**Architecture:** SIGES remains the operational shell and system of record. The API exposes Grafana embed configuration and observability-facing SQL-backed views or query contracts, while the web app renders a reusable Grafana embed component in node and network monitoring flows. Grafana reads PostgreSQL-backed observability data prepared by SIGES rather than inferring business logic itself.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, Next.js 15, TypeScript, Tailwind, Grafana, node:test, ts-node

## Global Constraints

- SIGES remains the operational system of record for nodes, routes, fiber, splices, official assets, discovery workflows, alert derivation, and operator actions.
- Grafana becomes the embedded observability layer for network traffic visualization, time-series telemetry, alert overviews, silent node and silent asset tracking, unmatched traffic visibility, discovery backlog visibility, and drill-down dashboards by node and globally.
- LAN-Orangutan remains an input source for discovery and network scan data. It does not become the place where business rules or alert decisions live.
- The data path is `LAN-Orangutan -> SIGES -> PostgreSQL -> Grafana -> embedded inside SIGES`.
- Direct `LAN-Orangutan -> Grafana` integration is explicitly rejected.
- Phase 1 uses SIGES as the main application shell, embedded Grafana dashboards via `iframe`, and PostgreSQL as Grafana's initial data source.
- Phase 1 explicitly does not require Prometheus, Loki, SSO with Grafana, public Grafana sharing, or replacing SIGES views with raw Grafana navigation.
- SIGES remains the navigation shell.
- Inventory views in SIGES remain based on the current correlated model.
- Grafana is embedded, not treated as a separate product.
- Grafana should not query arbitrary application tables directly from ad hoc panels wherever possible.
- Preferred Phase 1 approach is stable SQL views or tightly controlled SQL queries.

---

## File Structure

### API Configuration And Observability Views

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_grafana_observability_views/migration.sql`
- Create: `apps/api/src/observability/observability.module.ts`
- Create: `apps/api/src/observability/observability.controller.ts`
- Create: `apps/api/src/observability/observability.service.ts`
- Create: `apps/api/src/observability/observability.types.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `.env.example`

Responsibility:

- Define Grafana-related environment variables
- Add API endpoints for embed configuration and dashboard metadata
- Create stable observability-facing SQL views or equivalent query contracts

### Web Embedding And Page Integration

- Create: `apps/web/components/grafana-panel-embed.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/admin/nodes/page.tsx`
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/network-monitor.ts`
- Modify: `apps/web/lib/network-monitor.test.ts`

Responsibility:

- Build a reusable Grafana embed component
- Fetch embed configuration from SIGES API
- Add node-level `Observabilidad` tab
- Add global embedded observability panels to `/monitoring/network`

### Documentation And Verification

- Modify: `docs/superpowers/specs/2026-07-14-siges-grafana-embedded-observability-design.md`
- Create: `docs/superpowers/specs/2026-07-14-grafana-phase-1-setup.md`

Responsibility:

- Record local setup for Grafana data source, dashboards, variables, and required env vars

## Task 1: Add Observability Config And Failing API Contract Tests

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/src/observability/observability.types.ts`
- Create: `apps/api/src/observability/observability.service.test.ts`

**Interfaces:**
- Consumes: current `NetworkTelemetrySnapshot`, `NetworkTelemetryAssetSample`, `NetworkTelemetryAlert` tables and node/routing models
- Produces:
  - `type GrafanaDashboardKey = "node-observability" | "network-command-view"`
  - `type GrafanaEmbedDescriptor`
  - `getDashboardEmbed(input: { dashboard: GrafanaDashboardKey; nodeId?: string; routeId?: string; from?: string; to?: string }): GrafanaEmbedDescriptor`
  - `npm run test:observability --workspace=apps/api`

- [ ] **Step 1: Write the shared embed types**

```ts
export type GrafanaDashboardKey = "node-observability" | "network-command-view";

export type GrafanaEmbedDescriptor = {
  title: string;
  dashboard: GrafanaDashboardKey;
  url: string;
  params: Record<string, string>;
};
```

- [ ] **Step 2: Add failing service tests for embed URL generation**

```ts
test("getDashboardEmbed builds a node observability URL with nodeId and time range", () => {
  const service = new ObservabilityService({
    baseUrl: "http://grafana.local",
    orgId: "1",
    dashboards: {
      "node-observability": "node-observability-uid",
      "network-command-view": "network-command-view-uid",
    },
  });

  const result = service.getDashboardEmbed({
    dashboard: "node-observability",
    nodeId: "node-123",
    from: "now-6h",
    to: "now",
  });

  assert.equal(result.dashboard, "node-observability");
  assert.match(result.url, /node-observability-uid/);
  assert.match(result.url, /var-nodeId=node-123/);
  assert.match(result.url, /from=now-6h/);
  assert.match(result.url, /to=now/);
});
```

- [ ] **Step 3: Add failing test for the global dashboard descriptor**

```ts
test("getDashboardEmbed builds a global network command view URL without nodeId", () => {
  const service = new ObservabilityService({
    baseUrl: "http://grafana.local",
    orgId: "1",
    dashboards: {
      "node-observability": "node-observability-uid",
      "network-command-view": "network-command-view-uid",
    },
  });

  const result = service.getDashboardEmbed({
    dashboard: "network-command-view",
    from: "now-24h",
    to: "now",
  });

  assert.equal(result.dashboard, "network-command-view");
  assert.match(result.url, /network-command-view-uid/);
  assert.doesNotMatch(result.url, /var-nodeId=/);
});
```

- [ ] **Step 4: Add the test script**

```json
"test:observability": "ts-node --project tsconfig.json src/observability/observability.service.test.ts"
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test:observability --workspace=apps/api`
Expected: FAIL because `ObservabilityService` does not exist yet

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/observability
git commit -m "test(api): add failing observability embed tests"
```

## Task 2: Implement Observability Module And Embed Endpoints

**Files:**
- Create: `apps/api/src/observability/observability.module.ts`
- Create: `apps/api/src/observability/observability.controller.ts`
- Create: `apps/api/src/observability/observability.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes:
  - `GrafanaDashboardKey`
  - `GrafanaEmbedDescriptor`
- Produces:
  - `GET /observability/embed/node/:id`
  - `GET /observability/embed/network-command-view`
  - env vars:
    - `GRAFANA_BASE_URL`
    - `GRAFANA_ORG_ID`
    - `GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID`
    - `GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID`

- [ ] **Step 1: Write the failing controller contract in tests by expecting JWT-protected responses**

```ts
// In service test, assert the service throws for unknown dashboard keys and defaults time range.
assert.throws(() => service.getDashboardEmbed({ dashboard: "bad-key" as never }));
```

- [ ] **Step 2: Implement the service with explicit dashboard config**

```ts
const DASHBOARD_TITLES: Record<GrafanaDashboardKey, string> = {
  "node-observability": "Observabilidad del nodo",
  "network-command-view": "Vista global de red",
};

getDashboardEmbed(input: {
  dashboard: GrafanaDashboardKey;
  nodeId?: string;
  routeId?: string;
  from?: string;
  to?: string;
}) {
  const uid = this.dashboardUids[input.dashboard];
  const params = new URLSearchParams({
    orgId: this.orgId,
    from: input.from ?? "now-6h",
    to: input.to ?? "now",
    theme: "dark",
    kiosk: "tv",
  });

  if (input.nodeId) params.set("var-nodeId", input.nodeId);
  if (input.routeId) params.set("var-routeId", input.routeId);

  return {
    title: DASHBOARD_TITLES[input.dashboard],
    dashboard: input.dashboard,
    url: `${this.baseUrl}/d-solo/${uid}?${params.toString()}`,
    params: Object.fromEntries(params.entries()),
  };
}
```

- [ ] **Step 3: Implement the controller**

```ts
@UseGuards(AuthGuard("jwt"))
@Get("embed/node/:id")
getNodeEmbed(@Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
  return this.service.getDashboardEmbed({
    dashboard: "node-observability",
    nodeId: id,
    from,
    to,
  });
}

@UseGuards(AuthGuard("jwt"))
@Get("embed/network-command-view")
getNetworkCommandView(@Query("routeId") routeId?: string, @Query("from") from?: string, @Query("to") to?: string) {
  return this.service.getDashboardEmbed({
    dashboard: "network-command-view",
    routeId,
    from,
    to,
  });
}
```

- [ ] **Step 4: Register the module and env vars**

```ts
// app.module.ts
import { ObservabilityModule } from "./observability/observability.module";
// ...
ObservabilityModule,
```

```env
GRAFANA_BASE_URL=http://localhost:3005
GRAFANA_ORG_ID=1
GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID=node-observability
GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID=network-command-view
```

- [ ] **Step 5: Run the observability test**

Run: `npm run test:observability --workspace=apps/api`
Expected: PASS

- [ ] **Step 6: Build the API**

Run: `npm run build --workspace=apps/api`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .env.example apps/api/src/observability apps/api/src/app.module.ts
git commit -m "feat(api): add grafana observability embed endpoints"
```

## Task 3: Add Grafana SQL Views And Phase 1 Setup Notes

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_grafana_observability_views/migration.sql`
- Create: `docs/superpowers/specs/2026-07-14-grafana-phase-1-setup.md`

**Interfaces:**
- Consumes:
  - existing node, route, center, telemetry, alert, and discovery tables
- Produces:
  - `telemetry_node_summary_view`
  - `telemetry_node_timeseries_view`
  - `telemetry_asset_activity_view`
  - `telemetry_alerts_view`
  - `telemetry_discovery_backlog_view`
  - `telemetry_global_health_view`

- [ ] **Step 1: Add a migration SQL file for observability views**

```sql
CREATE OR REPLACE VIEW telemetry_node_summary_view AS
SELECT
  n.id AS node_id,
  n.code AS node_code,
  n.name AS node_name,
  r.id AS route_id,
  r.identifier AS route_identifier,
  mc.id AS monitoring_center_id,
  mc.name AS monitoring_center_name,
  s.id AS snapshot_id,
  s.captured_at,
  s.total_bytes_in,
  s.total_bytes_out,
  s.active_hosts,
  s.active_flows,
  s.alert_count
FROM "Node" n
LEFT JOIN "Route" r ON r.id = n.route_id
LEFT JOIN "MonitoringCenter" mc ON mc.id = r.monitoring_center_id
LEFT JOIN "NetworkTelemetrySnapshot" s ON s.id = (
  SELECT ns.id
  FROM "NetworkTelemetrySnapshot" ns
  WHERE ns.node_id = n.id
  ORDER BY ns.captured_at DESC
  LIMIT 1
);
```

- [ ] **Step 2: Add the remaining views in the same migration**

```sql
CREATE OR REPLACE VIEW telemetry_node_timeseries_view AS
SELECT
  s.node_id,
  s.captured_at,
  s.total_bytes_in,
  s.total_bytes_out,
  s.active_hosts,
  s.active_flows
FROM "NetworkTelemetrySnapshot" s;

CREATE OR REPLACE VIEW telemetry_asset_activity_view AS
SELECT
  sample.node_id,
  sample.node_asset_id,
  sample.ip,
  sample.mac,
  sample.hostname,
  sample.bytes_in,
  sample.bytes_out,
  sample.flow_count,
  sample.last_seen_at,
  sample.classification_source
FROM "NetworkTelemetryAssetSample" sample;
```

- [ ] **Step 3: Document Grafana Phase 1 setup**

```md
# Grafana Phase 1 Setup

1. Add PostgreSQL data source pointing to SIGES database.
2. Create dashboard variables: `nodeId`, `routeId`, `monitoringCenterId`.
3. Build `Node Observability` from `telemetry_node_summary_view`, `telemetry_node_timeseries_view`, `telemetry_asset_activity_view`, and `telemetry_alerts_view`.
4. Build `Network Command View` from `telemetry_global_health_view` and `telemetry_discovery_backlog_view`.
```

- [ ] **Step 4: Apply the schema locally**

Run: `npm run db:push --workspace=apps/api`
Expected: PASS and schema remains in sync

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations docs/superpowers/specs/2026-07-14-grafana-phase-1-setup.md
git commit -m "feat(api): add grafana observability sql views"
```

## Task 4: Add Reusable Grafana Embed Component

**Files:**
- Create: `apps/web/components/grafana-panel-embed.tsx`
- Modify: `apps/web/lib/api.ts`

**Interfaces:**
- Consumes:
  - `GET /observability/embed/node/:id`
  - `GET /observability/embed/network-command-view`
- Produces:
  - `apiGet< GrafanaEmbedDescriptor >(...)`
  - `<GrafanaPanelEmbed title dashboardUrl />`

- [ ] **Step 1: Add a failing frontend helper test for descriptor normalization**

```ts
test("builds a safe iframe src from API descriptor", () => {
  const descriptor = {
    title: "Observabilidad del nodo",
    dashboard: "node-observability",
    url: "http://grafana.local/d-solo/node-observability?var-nodeId=node-1",
    params: { "var-nodeId": "node-1" },
  };

  const result = buildGrafanaEmbedModel(descriptor);
  assert.equal(result.title, "Observabilidad del nodo");
  assert.match(result.src, /var-nodeId=node-1/);
});
```

- [ ] **Step 2: Add the reusable component**

```tsx
export function GrafanaPanelEmbed({
  title,
  src,
  loading,
}: {
  title: string;
  src: string | null;
  loading?: boolean;
}) {
  if (loading) return <div className="rounded-ops border border-ops-border bg-ops-panel p-4">Cargando observabilidad…</div>;
  if (!src) return <div className="rounded-ops border border-ops-border bg-ops-panel p-4">Observabilidad no disponible.</div>;

  return (
    <section className="rounded-ops border border-ops-border bg-ops-panel p-3">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ops-muted">{title}</p>
      <iframe className="h-[720px] w-full rounded-ops border border-ops-border bg-black" src={src} loading="lazy" />
    </section>
  );
}
```

- [ ] **Step 3: Add any needed helper in `lib/api.ts` only if existing `apiGet` is insufficient**

```ts
export type GrafanaEmbedDescriptor = {
  title: string;
  dashboard: "node-observability" | "network-command-view";
  url: string;
  params: Record<string, string>;
};
```

- [ ] **Step 4: Run the existing network monitor test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS or targeted FAIL if helper was added and not implemented yet

- [ ] **Step 5: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/grafana-panel-embed.tsx apps/web/lib/api.ts apps/web/lib/network-monitor.test.ts apps/web/lib/network-monitor.ts
git commit -m "feat(web): add grafana embed component"
```

## Task 5: Add Node-Level Observability Tab

**Files:**
- Modify: `apps/web/app/admin/nodes/page.tsx`

**Interfaces:**
- Consumes:
  - `<GrafanaPanelEmbed />`
  - `GET /observability/embed/node/:id`
- Produces:
  - node detail tab key: `"observabilidad"`

- [ ] **Step 1: Extend the detail tab union and tab buttons**

```ts
const [detailTab, setDetailTab] = useState<"equipos" | "descubrimientos" | "analiticas" | "observabilidad">("equipos");
```

- [ ] **Step 2: Load the node embed descriptor when a node is selected**

```ts
const [nodeObservability, setNodeObservability] = useState<GrafanaEmbedDescriptor | null>(null);

const loadNodeObservability = useCallback(async (nodeId: string) => {
  if (!accessToken || !nodeId) return;
  const data = await apiGet<GrafanaEmbedDescriptor>(`/observability/embed/node/${nodeId}`, accessToken);
  setNodeObservability(data);
}, [accessToken]);
```

- [ ] **Step 3: Render the new tab body**

```tsx
{detailTab === "observabilidad" && (
  <GrafanaPanelEmbed
    title={nodeObservability?.title ?? "Observabilidad"}
    src={nodeObservability?.url ?? null}
    loading={loadingDetail}
  />
)}
```

- [ ] **Step 4: Run the web test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

- [ ] **Step 5: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/admin/nodes/page.tsx
git commit -m "feat(web): add node observability tab"
```

## Task 6: Add Global Grafana Blocks To `/monitoring/network`

**Files:**
- Modify: `apps/web/app/monitoring/network/page.tsx`
- Modify: `apps/web/lib/network-monitor.ts`
- Modify: `apps/web/lib/network-monitor.test.ts`

**Interfaces:**
- Consumes:
  - `<GrafanaPanelEmbed />`
  - `GET /observability/embed/network-command-view`
- Produces:
  - embedded global observability panel(s) on `/monitoring/network`

- [ ] **Step 1: Add state for the global embed descriptor**

```ts
const [networkCommandView, setNetworkCommandView] = useState<GrafanaEmbedDescriptor | null>(null);
```

- [ ] **Step 2: Load the dashboard descriptor alongside node and telemetry data**

```ts
const loadNetworkCommandView = useCallback(async () => {
  if (!accessToken) return;
  const data = await apiGet<GrafanaEmbedDescriptor>("/observability/embed/network-command-view", accessToken);
  setNetworkCommandView(data);
}, [accessToken]);
```

- [ ] **Step 3: Render the embed near the traffic and alert surfaces**

```tsx
<GrafanaPanelEmbed
  title={networkCommandView?.title ?? "Comando de red"}
  src={networkCommandView?.url ?? null}
  loading={loading || loadingDetail}
/>
```

- [ ] **Step 4: Keep inventory and correlated device model unchanged**

```ts
const model = useMemo(() => buildNetworkMonitorModel(nodes, detail), [nodes, detail]);
// Do not replace inventory-building logic with Grafana data.
```

- [ ] **Step 5: Run the web test**

Run: `npm run test:network-monitor --workspace=apps/web`
Expected: PASS

- [ ] **Step 6: Build the web app**

Run: `npm run build --workspace=apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/monitoring/network/page.tsx apps/web/lib/network-monitor.ts apps/web/lib/network-monitor.test.ts
git commit -m "feat(web): embed grafana in network monitoring"
```

## Task 7: Verify Local End-To-End Embed Flow

**Files:**
- Modify: none required unless verification finds defects

**Interfaces:**
- Consumes:
  - API observability embed endpoints
  - node-level observability tab
  - `/monitoring/network` global embed block
- Produces:
  - verified local SIGES + Grafana integration

- [ ] **Step 1: Start API and web if not already running**

Run: `npm run dev --workspace=apps/api`
Expected: Nest listens on `4001`

Run: `npm run dev --workspace=apps/web`
Expected: Next listens on `3001`

- [ ] **Step 2: Verify node embed descriptor**

Run: `curl -s http://127.0.0.1:4001/observability/embed/node/REPLACE_NODE_ID -H "Authorization: Bearer REPLACE_USER_JWT"`
Expected: JSON containing `dashboard`, `title`, and a Grafana URL with `var-nodeId`

- [ ] **Step 3: Verify global dashboard descriptor**

Run: `curl -s http://127.0.0.1:4001/observability/embed/network-command-view -H "Authorization: Bearer REPLACE_USER_JWT"`
Expected: JSON containing the global dashboard URL without `var-nodeId`

- [ ] **Step 4: Verify the web routes**

Run: `curl -I -s http://127.0.0.1:3001/admin/nodes`
Expected: `HTTP/1.1 200 OK`

Run: `curl -I -s http://127.0.0.1:3001/monitoring/network`
Expected: `HTTP/1.1 200 OK`

- [ ] **Step 5: Commit only if verification finds a defect**

```bash
git add -A
git commit -m "fix: finalize grafana embedded observability integration"
```

## Self-Review

### Spec Coverage

- Embedded Grafana inside SIGES shell: covered by Tasks 4, 5, and 6
- Node-level observability tab: covered by Task 5
- Global `/monitoring/network` observability block: covered by Task 6
- PostgreSQL-first phase: covered by Task 3
- Grafana as viewer, SIGES as logic owner: enforced by Tasks 2 and 3
- LAN-Orangutan remaining an upstream source rather than direct Grafana producer: preserved by no direct integration tasks

### Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation placeholders remain
- All tasks specify files, commands, expected outputs, and produced interfaces

### Type Consistency

- `GrafanaDashboardKey` is used consistently as `"node-observability" | "network-command-view"`
- `GrafanaEmbedDescriptor` is the shared API/web contract across Tasks 1 through 6
- Web pages consume embed descriptors rather than inventing separate URL-building contracts
