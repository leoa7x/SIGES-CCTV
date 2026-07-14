Status: DONE

Commit created: `3e3b3f1 feat(api): derive network telemetry silent alerts`

Changed files:
- `apps/api/src/network-telemetry/network-telemetry.alerts.ts`
- `apps/api/src/network-telemetry/network-telemetry.service.ts`
- `apps/api/src/network-telemetry/network-telemetry.service.test.ts`

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 13/13 tests.

Concern:
- Unrelated existing worktree changes remain untouched.

Review fix:
- Fresh telemetry now resolves active NODE_SILENT alerts.
- Visible assets now resolve active ASSET_SILENT alerts.
- Added recovery-path tests.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 15/15 tests.

Review fix 2:
- ASSET_SILENT ahora usa una identidad estable basada en asset.id.
- Se agrego una regresion para rename de activo silencioso.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 16/16 tests.

Review fix 3:
- ASSET_SILENT ahora tambien se deriva durante outage del nodo.
- Se agrego regresion para nodo silencioso + activo oficial sin muestras recientes.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 17/17 tests.

Review fix 4:
- Los nodeId inexistentes ahora devuelven summary por defecto o lista vacia antes de derivar alertas silenciosas.
- Se agrego regresion para unknown nodes y cobertura directa de ASSET_SILENT desde summary.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 19/19 tests.

Review fix 5:
- Las ASSET_SILENT activas ahora se resuelven si el activo ya no pertenece al nodo.
- Se agrego regresion para alertas silenciosas huerfanas.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: passed with 20/20 tests.
