# Task 6: Global Grafana Blocks for Network Monitoring

## Scope

- Added the global `network-command-view` Grafana descriptor to `/monitoring/network`.
- Preserved the existing SIGES inventory, discovery, correlated-device, and per-node telemetry flows.

## Implementation

- `apps/web/app/monitoring/network/page.tsx`
  - Stores the global `GrafanaEmbedDescriptor` and its loading state.
  - Fetches `GET /observability/embed/network-command-view` for authenticated users.
  - Ignores completed requests after effect cleanup and falls back to the reusable unavailable state on fetch failure.
  - Converts the descriptor with `buildGrafanaEmbedModel` and renders `GrafanaPanelEmbed` above the node-specific monitoring workspace.
- `apps/web/lib/network-monitor.test.ts`
  - Covers a `network-command-view` descriptor and its global time-range parameters.

## Verification

- `npm run test:network-monitor --workspace=apps/web` passed: 8 tests, 0 failures.
- `npm run build --workspace=apps/web` passed: Next.js production build and type validation completed successfully.
- `git diff --check` completed with no whitespace errors.

## Self-Review

- Confirmed the Grafana endpoint is loaded independently of selected-node detail requests, so global observability remains available without a selected node.
- Confirmed existing `buildNetworkMonitorModel(nodes, detail)` remains unchanged and continues to drive inventory, discovery, and correlated device UI.
- Confirmed the patch only introduces the global descriptor state, request lifecycle, reusable embed rendering, and focused helper coverage; unrelated in-flight page edits were not included in the task patch.

## Commit

- `feat(web): embed grafana in network monitoring`
