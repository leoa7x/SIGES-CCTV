# Task 3 Report: Telemetry Service Ingestion And Correlation

## Scope

- Added `apps/api/src/network-telemetry/network-telemetry.service.ts`.
- Left unrelated worktree changes untouched.

## Implementation

- `ingestSnapshot` validates the node, persists the telemetry snapshot, stores correlated asset samples, and returns snapshot/sample/alert counts.
- Asset correlation follows the required precedence: official MAC, official IP, newest discovery MAC, newest discovery IP, then unmatched.
- Unmatched samples produce informational `UNMATCHED_TRAFFIC` alert upsert payloads; official and discovery samples do not.
- Telemetry protocol and destination DTO arrays are passed as Prisma JSON input values.

## Test-Driven Verification

1. Ran `npm run test:network-telemetry --workspace=apps/api` before the service existed. It failed as expected with TS2307 because `network-telemetry.service` was missing.
2. Regenerated the local Prisma Client from the existing Task 1 schema. The installed client was stale and lacked all telemetry delegates and enums; no tracked source files were changed by generation.
3. Ran `npm run test:network-telemetry --workspace=apps/api`: PASS, 1 test, 0 failures.
4. Ran `npm run build --workspace=apps/api`: PASS.
5. Ran `git diff --check`: PASS.

## Self-Review

- Confirmed snapshot fields, BigInt conversions, conditional `createMany`, return counts, and all four correlation lookups match the Task 3 brief.
- Confirmed unmatched-alert titles, severity, timestamps, active state, and resolution reset match the brief.
- The existing test verifies the highest-priority official-MAC match and sample persistence. It does not exercise discovery, IP fallback, or unmatched alert behavior.

## Concern

`NetworkTelemetryAlert` has no `@@unique([nodeId, kind, title])` in Task 1's schema or migration. The Task 3 brief requires an upsert selector named `nodeId_kind_title`, which Prisma Client does not generate without that constraint. The service preserves the mandated upsert payload using a narrow type bridge, but real unmatched-alert ingestion will fail at runtime until the Task 1 schema and migration add the compound unique constraint and Prisma Client is regenerated. This was not changed because it is outside Task 3 ownership.

## Review Fix Verification

- Added `@@unique([nodeId, kind, title])` and a forward-only migration, then regenerated Prisma Client so `nodeId_kind_title` is a real upsert selector.
- Removed the unsafe `as never` alert-upsert bridge from the service.
- Expanded focused coverage for official-IP fallback, discovery MAC precedence with newest-first ordering, unmatched alert creation, and the Prisma compound selector payload.
- Ran `npm run test:network-telemetry --workspace=apps/api`: PASS, 5 tests, 0 failures.
- Ran `npm run build --workspace=apps/api`: PASS.
