Task 1: Add observability config and failing API contract tests.

Scope:
- Modify `apps/api/package.json`
- Create `apps/api/src/observability/observability.types.ts`
- Create `apps/api/src/observability/observability.service.test.ts`

Required outputs:
- `type GrafanaDashboardKey = "node-observability" | "network-command-view"`
- `type GrafanaEmbedDescriptor`
- `getDashboardEmbed(input: { dashboard: GrafanaDashboardKey; nodeId?: string; routeId?: string; from?: string; to?: string }): GrafanaEmbedDescriptor`
- `npm run test:observability --workspace=apps/api`

Constraints:
- Keep work limited to failing contract/tests and shared types
- Do not implement the service/module/controller yet
- Test should fail because `ObservabilityService` does not exist yet
- Do not touch unrelated files or revert existing worktree changes

Verification required:
- `npm run test:observability --workspace=apps/api` must fail for the intended missing implementation reason

Commit message:
- `test(api): add failing observability embed tests`
