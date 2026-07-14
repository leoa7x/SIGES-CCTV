Status: DONE

Commits created:
- `7b695b5 feat(api): add grafana observability sql views`
- `pending fix(api): document grafana asset type filter`

Changed files:
- `apps/api/prisma/migrations/20260714110000_grafana_observability_views/migration.sql`
- `docs/superpowers/specs/2026-07-14-grafana-phase-1-setup.md`

Verification:
- Command: `npm run db:push --workspace=apps/api`
- Result: exit 0; database already in sync and Prisma Client generated.
- Command: `./node_modules/.bin/dotenv -e .env -- ./node_modules/.bin/prisma db execute --file apps/api/prisma/migrations/20260714110000_grafana_observability_views/migration.sql --schema apps/api/prisma/schema.prisma`
- Result: Script executed successfully.
- Command: `./node_modules/.bin/dotenv -e .env -- ./node_modules/.bin/prisma db execute --stdin --schema apps/api/prisma/schema.prisma` with SELECT COUNT(*) against all six views
- Result: exit 0; Script executed successfully.
