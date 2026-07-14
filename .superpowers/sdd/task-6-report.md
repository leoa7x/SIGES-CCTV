Status: DONE

Commit created: `481f921 feat(web): wire network monitor to telemetry api`

Changed files:
- `apps/web/app/monitoring/network/page.tsx`
- `apps/web/lib/network-monitor.ts`
- `apps/web/lib/network-monitor.test.ts`

Verification:
- Command: `npm run test:network-monitor --workspace=apps/web`
- Result: PASS, 3 tests, 0 failures.
- Command: `npm run build --workspace=apps/web`
- Result: PASS, compiled, type-checked, and generated 18 static pages.

Concern:
- Unrelated pre-existing uncommitted changes remain in the worktree and were not staged or committed.

Review fix:
- El loader de detalle ahora descarta respuestas stale con guardas de nodo actual y secuencia de request.
- Limpia detail/telemetria al cargar y tras fallos del request activo.

Verification:
- Command: `npm run test:network-monitor --workspace=apps/web`
- Result: PASS, 4 tests.
- Command: `npm run build --workspace=apps/web`
- Result: PASS, compiled, type-checked, generated 18 static pages.
