Status: DONE

Commit created: `3cbf220 feat(api): add network telemetry endpoints`

Changed files:
- `apps/api/src/network-telemetry/network-telemetry.controller.ts`
- `apps/api/src/network-telemetry/network-telemetry.module.ts`
- `apps/api/src/network-telemetry/network-telemetry.service.ts`
- `apps/api/src/app.module.ts`

Verification:
- Command: `npm run build --workspace=apps/api`
- Result: completed successfully with exit code `0` (`nest build`)

Concern:
- Unrelated pre-existing working-tree changes remain unstaged and were not modified.

Review fix:
- Serialized `totalBytesIn` and `totalBytesOut` in timeseries responses, and `bytesIn` and `bytesOut` in asset responses, preventing Prisma `BigInt` values from reaching JSON serialization.
- Added service coverage that asserts these fields are strings and the results can be passed to `JSON.stringify`.

Verification:
- Command: `npm run test:network-telemetry --workspace=apps/api`
- Result: completed successfully with exit code `0` (10 passing tests).
- Command: `npm run build --workspace=apps/api`
- Result: completed successfully with exit code `0` (`nest build`).
