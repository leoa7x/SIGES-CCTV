Task 6: Add global Grafana blocks to `/monitoring/network`.

Scope:
- Modify `apps/web/app/monitoring/network/page.tsx`
- Modify `apps/web/lib/network-monitor.ts`
- Modify `apps/web/lib/network-monitor.test.ts`

Required outputs:
- Add state for the global embed descriptor
- Load `GET /observability/embed/network-command-view` alongside the current network monitoring data
- Render embedded global observability panel(s) on `/monitoring/network`
- Keep the current inventory, discovery, and correlated device model driven by existing SIGES logic

Constraints:
- Reuse the existing `GrafanaEmbedDescriptor` contract and `GrafanaPanelEmbed` component
- Do not replace the current `buildNetworkMonitorModel(nodes, detail)` flow with Grafana data
- Preserve the existing monitoring page UX direction and any unrelated local changes already present
- Keep the page on the existing app surface and port `3001`

Verification required:
- `npm run test:network-monitor --workspace=apps/web`
- `npm run build --workspace=apps/web`

Commit message:
- `feat(web): embed grafana in network monitoring`
