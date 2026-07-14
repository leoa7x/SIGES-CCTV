Task 2: Implement observability module and embed endpoints.

Scope:
- Create `apps/api/src/observability/observability.module.ts`
- Create `apps/api/src/observability/observability.controller.ts`
- Create `apps/api/src/observability/observability.service.ts`
- Modify `apps/api/src/app.module.ts`
- Modify `.env.example`

Required outputs:
- `GET /observability/embed/node/:id`
- `GET /observability/embed/network-command-view`
- env vars:
  - `GRAFANA_BASE_URL`
  - `GRAFANA_ORG_ID`
  - `GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID`
  - `GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID`

Constraints:
- Reuse the Task 1 types and test contract
- Query endpoints must use JWT auth
- Service must generate stable Grafana URLs and `params`
- Keep work limited to the observability module files, `.env.example`, and `app.module.ts`
- Do not touch SQL views or frontend yet

Verification required:
- `npm run test:observability --workspace=apps/api`
- `npm run build --workspace=apps/api`

Commit message:
- `feat(api): add grafana observability embed endpoints`
