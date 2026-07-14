Status: DONE

Commits created:
- `f04d464 test(api): add failing observability embed tests`
- `a44d9cb fix(api): tighten observability embed test contract`
- `pending fix(api): cover observability embed descriptor contract`

Changed files:
- `apps/api/package.json`
- `apps/api/src/observability/observability.types.ts`
- `apps/api/src/observability/observability.service.test.ts`

Verification:
- Command: `npm run test:observability --workspace=apps/api`
- Result: failed as intended with `TS2307: Cannot find module ./observability.service`.
