Task 5: Add node-level observability tab.

Scope:
- Modify `apps/web/app/admin/nodes/page.tsx`

Required outputs:
- Extend the node detail tab union to include `observabilidad`
- Add a visible tab trigger for `Observabilidad`
- Load the node embed descriptor from `GET /observability/embed/node/:id` when a node is selected
- Render the tab body using the reusable `GrafanaPanelEmbed` component
- Keep the node page on port `3001` and inside the existing SIGES admin shell

Constraints:
- Work carefully in `apps/web/app/admin/nodes/page.tsx`; that file already has parallel UX/UI edits
- Do not revert or overwrite unrelated local modifications
- Reuse the existing `GrafanaEmbedDescriptor` contract and `buildGrafanaEmbedModel`
- Keep the existing node CRUD, discovery, and analytics flows intact
- Show a sensible loading/empty state when the embed descriptor is not yet available

Verification required:
- `npm run test:network-monitor --workspace=apps/web`
- `npm run build --workspace=apps/web`

Commit message:
- `feat(web): add node observability tab`
