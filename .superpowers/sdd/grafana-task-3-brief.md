Task 3: Add Grafana SQL views and Phase 1 setup notes.

Scope:
- Create `apps/api/prisma/migrations/<timestamp>_grafana_observability_views/migration.sql`
- Create `docs/superpowers/specs/2026-07-14-grafana-phase-1-setup.md`
- Modify `apps/api/prisma/schema.prisma` only if truly required by the SQL-view delivery

Required outputs:
- `telemetry_node_summary_view`
- `telemetry_node_timeseries_view`
- `telemetry_asset_activity_view`
- `telemetry_alerts_view`
- `telemetry_discovery_backlog_view`
- `telemetry_global_health_view`
- setup doc for Grafana Phase 1 datasource, variables, and dashboard wiring

Constraints:
- Prefer SQL-only view delivery; do not force meaningless Prisma model changes
- Keep views aligned to current telemetry, node, route, center, alert, and discovery data
- Keep work limited to migration SQL, setup doc, and `schema.prisma` only if needed
- Do not touch frontend or observability controller/service files in this task

Verification required:
- `npm run db:push --workspace=apps/api`
- If you apply SQL locally for validation, report the exact command and result

Commit message:
- `feat(api): add grafana observability sql views`
