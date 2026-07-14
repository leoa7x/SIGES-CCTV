Task 6: Wire `/monitoring/network` to telemetry summary and query endpoints.

Scope:
- Modify `apps/web/app/monitoring/network/page.tsx`
- Modify `apps/web/lib/network-monitor.ts`
- Modify `apps/web/lib/network-monitor.test.ts`

Required outputs:
- Traffic and alert tabs driven by:
  - `GET /network-telemetry/nodes/:id/summary`
  - `GET /network-telemetry/nodes/:id/timeseries`
  - `GET /network-telemetry/nodes/:id/assets`
  - `GET /network-telemetry/nodes/:id/alerts`

Constraints:
- Keep inventory tab on current correlated model
- Use telemetry assets for activity/observability cards
- Replace local placeholder traffic derivations with telemetry API responses
- Keep work limited to the web monitor files above

Verification required:
- `npm run test:network-monitor --workspace=apps/web`
- `npm run build --workspace=apps/web`

Commit message:
- `feat(web): wire network monitor to telemetry api`
