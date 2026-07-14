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
