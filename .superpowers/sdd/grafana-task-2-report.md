Status: DONE

Commit created: `690719a feat(api): add grafana observability embed endpoints`

Changed files:
- `.env.example`
- `apps/api/src/app.module.ts`
- `apps/api/src/observability/observability.controller.ts`
- `apps/api/src/observability/observability.module.ts`
- `apps/api/src/observability/observability.service.ts`
- `apps/api/src/observability/observability.service.test.ts`

Verification:
- Command: `npm run test:observability --workspace=apps/api`
- Result: 5 passed, 0 failed.
- Command: `npm run build --workspace=apps/api`
- Result: succeeded with exit code 0.
