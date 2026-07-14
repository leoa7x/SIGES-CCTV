Task 4: Add controller, module, and query endpoints for network telemetry.

Scope:
- Create `apps/api/src/network-telemetry/network-telemetry.controller.ts`
- Create `apps/api/src/network-telemetry/network-telemetry.module.ts`
- Modify `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify `apps/api/src/app.module.ts`

Required outputs:
- `POST /network-telemetry/ingest`
- `GET /network-telemetry/nodes/:id/summary`
- `GET /network-telemetry/nodes/:id/timeseries`
- `GET /network-telemetry/nodes/:id/assets`
- `GET /network-telemetry/nodes/:id/alerts`

Constraints:
- Ingest route must validate bearer token from `NETWORK_TELEMETRY_INGEST_TOKEN`
- Query routes must use JWT auth
- Reuse `NetworkTelemetryService.ingestSnapshot`
- Keep work limited to API telemetry module wiring and read/query endpoints

Verification required:
- `npm run build --workspace=apps/api`

Commit message:
- `feat(api): add network telemetry endpoints`
