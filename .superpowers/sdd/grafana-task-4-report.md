Status: DONE

Commits created:
- `e3453ec feat(web): add grafana embed component`
- `pending fix(web): honor grafana embed params and safety tests`

Changed files:
- `apps/web/components/grafana-panel-embed.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/network-monitor.ts`
- `apps/web/lib/network-monitor.test.ts`

Verification:
- Command: `npm run test:network-monitor --workspace=apps/web`
- Result: passed 7/7 tests.
- Command: `npm run build --workspace=apps/web`
- Result: production build completed successfully.
