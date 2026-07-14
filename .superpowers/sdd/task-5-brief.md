Task 5: Add silent-node and silent-asset alert derivation for network telemetry.

Scope:
- Create `apps/api/src/network-telemetry/network-telemetry.alerts.ts`
- Modify `apps/api/src/network-telemetry/network-telemetry.service.ts`
- Modify `apps/api/src/network-telemetry/network-telemetry.service.test.ts`

Required outputs:
- `deriveNodeSilentAlert`
- `deriveSilentAssetAlerts`
- Silent alerts must be upserted during summary and alert queries

Constraints:
- Work only within telemetry API files
- Use recent snapshots and recent asset sample visibility
- Keep alert kinds within v1 list: `NODE_SILENT`, `ASSET_SILENT`, `UNMATCHED_TRAFFIC`, `NEW_DESTINATION`
- Do not add packet capture, raw traffic storage, official asset auto-creation, or discovery mutation

Verification required:
- `npm run test:network-telemetry --workspace=apps/api`

Commit message:
- `feat(api): derive network telemetry silent alerts`
