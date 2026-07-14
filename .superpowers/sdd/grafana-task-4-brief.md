Task 4: Add reusable Grafana embed component.

Scope:
- Create `apps/web/components/grafana-panel-embed.tsx`
- Modify `apps/web/lib/api.ts`
- Modify `apps/web/lib/network-monitor.ts`
- Modify `apps/web/lib/network-monitor.test.ts`

Required outputs:
- reusable `<GrafanaPanelEmbed />`
- any minimal shared `GrafanaEmbedDescriptor` web type/helper needed by the pages
- passing `npm run test:network-monitor --workspace=apps/web`
- passing `npm run build --workspace=apps/web`

Constraints:
- Do not modify `apps/web/app/admin/nodes/page.tsx`
- Do not modify `apps/web/app/monitoring/network/page.tsx`
- Keep this task focused on reusable web primitives only
- If a helper is added, it must be covered by focused tests
- Do not revert unrelated UI/UX changes already present in the worktree

Commit message:
- `feat(web): add grafana embed component`
