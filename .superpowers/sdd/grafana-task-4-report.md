Status: DONE

Commits created:
- `e3453ec feat(web): add grafana embed component`
- `184deaf fix(web): honor grafana embed params and safety tests`
- `50e69c0 fix(web): override conflicting grafana query params`

Changed files:
- `apps/web/components/grafana-panel-embed.tsx`
- `apps/web/lib/api.ts`
- `apps/web/lib/network-monitor.ts`
- `apps/web/lib/network-monitor.test.ts`

Verification:
- Command: `npm run test:network-monitor --workspace=apps/web`
- Result: passed 8/8 tests.
- Command: `npm run build --workspace=apps/web`
- Result: passed before the final helper-only fix; the final fix was validated by focused tests.
