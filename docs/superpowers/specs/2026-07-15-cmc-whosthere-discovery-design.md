# CMC Discovery With WhosThere Design

## Goal

Implement phase 2 for monitoring centers (`CMC`) so internal LAN devices can be discovered with `whosthere`, reviewed by an operator, and confirmed into the official `CenterAsset` inventory.

This phase must stay separate from the existing node discovery flow:

- `LAN-Orangutan` remains the discovery source for field nodes
- `whosthere` becomes the discovery source for CMC infrastructure
- confirmed CMC findings become `CenterAsset`

## Scope

This phase includes:

- scan target configuration on `MonitoringCenter`
- discovery jobs scoped by `centerId`
- normalization of raw `whosthere` output
- pending backlog for discovered CMC devices
- confirm and dismiss actions
- merge-or-create behavior into `CenterAsset`
- admin UI for running scans and curating results

This phase does not include:

- traffic telemetry ingestion for CMC assets
- Grafana panels dedicated to CMC discovery
- running discovery from the network monitoring screen
- unifying node and CMC discovery into one generic engine

## Approved Decisions

- CMC discovery uses the same operational scan inputs used by nodes: `primaryIp` and `scanSubnetCidr`
- confirming a discovered CMC device must automatically create or merge a `CenterAsset`
- the operational UI for discovery lives in `Administración > CMC`
- `Monitoreo de Red` continues consuming only official confirmed CMC assets

## Data Model

### MonitoringCenter

Add these nullable fields:

- `primaryIp String?`
- `scanSubnetCidr String?`

Purpose:

- `primaryIp` supports target-aware scans and parity with node discovery
- `scanSubnetCidr` defines the preferred LAN segment for `whosthere`

### CenterDiscoveryJob

New entity parallel to `NodeDiscoveryJob`.

Fields:

- `id`
- `centerId`
- `requestedByUserId`
- `status`
- `targetIp`
- `targetSubnetCidr`
- `rawSummary Json?`
- `errorMessage String?`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

Relationships:

- belongs to `MonitoringCenter`
- optionally belongs to `User`
- has many `CenterDiscoveredDevice`

Status enum:

- reuse existing `NodeDiscoveryStatus`
- values used by CMC discovery:
  - `PENDING`
  - `RUNNING`
  - `COMPLETED`
  - `FAILED`

### CenterDiscoveredDevice

New entity parallel to `NodeDiscoveredDevice`.

Fields:

- `id`
- `centerDiscoveryJobId`
- `matchedAssetId String?`
- `candidateType`
- `name`
- `ip`
- `mac`
- `vendor`
- `model`
- `hostname`
- `discoveryConfidence`
- `rawPayload Json`
- `status`
- `createdAt`
- `updatedAt`

Relationships:

- belongs to `CenterDiscoveryJob`
- optionally belongs to `CenterAsset` through `matchedAssetId`

Status values:

- reuse existing `NodeDiscoveredDeviceStatus`
- values used by CMC discovery:
  - `DISCOVERED`
  - `CONFIRMED`
  - `DISMISSED`
  - `MERGED`

## Discovery Execution

Add a dedicated wrapper for `whosthere`, equivalent in intent to `run_lan_orangutan_scan.py`.

Expected behavior:

- accepts a target CIDR and optional primary IP context
- executes `whosthere` without shell interpolation risk
- converts raw tool output into JSON consumable by the API
- returns either:
  - an array of normalized raw devices
  - or an object with `success`, `error`, and `devices`

Recommended environment variables:

- `WHOSTHERE_HOME`
- `WHOSTHERE_CMD`

`WHOSTHERE_CMD` should support placeholders:

- `{target}` for subnet CIDR
- `{ip}` for primary IP

## Service

Create `CenterDiscoveryService`.

Responsibilities:

- resolve scan target from `MonitoringCenter.primaryIp` and `MonitoringCenter.scanSubnetCidr`
- validate the target before execution
- create and finalize `CenterDiscoveryJob`
- invoke the `whosthere` wrapper
- normalize raw findings into a stable internal shape
- persist `CenterDiscoveredDevice`
- confirm or dismiss discovered devices

The service should mirror the behavior of `NodeDiscoveryService`, but remain scoped to `centerId`.

## Normalization

Raw `whosthere` output must be normalized into the same internal discovery shape already used by nodes:

- `candidateType`
- `name`
- `ip`
- `mac`
- `vendor`
- `model`
- `hostname`
- `discoveryConfidence`
- `rawPayload`

Type mapping should stay aligned with the current `NodeAssetType` values so confirmed findings can be promoted directly into `CenterAsset`.

Unknown types should fall back to `OTHER`.

## Confirmation Rules

When confirming a `CenterDiscoveredDevice`:

1. find an existing `CenterAsset` in the same `centerId` by `mac`
2. if not found, try by `ip`
3. if found, update the asset and mark the finding as `MERGED`
4. if not found, create a new `CenterAsset` and mark the finding as `CONFIRMED`

Confirmed or merged assets must:

- preserve `centerId`
- use the chosen or inferred `assetType`
- default name from:
  - explicit confirmation payload
  - discovered `name`
  - discovered `hostname`
  - inferred asset type
- store `source` as discovery-derived:
  - `DISCOVERY`
  - or `DISCOVERY_ENRICHED` when extra metadata exists

Dismissed findings must remain auditable in the backlog with status `DISMISSED`.

## API Design

### Monitoring center endpoints

- `POST /monitoring-centers/:id/discovery-jobs`
  - launches a `whosthere` scan for that CMC
  - requires admin permission

- `GET /monitoring-centers/:id`
  - extends existing detail response
  - includes recent `discoveryJobs`
  - includes nested `discoveredDevices`

### Center discovery endpoints

- `POST /center-discovery/devices/:id/confirm`
- `POST /center-discovery/devices/:id/dismiss`

The confirmation payload should mirror node discovery confirmation:

- optional `assetType`
- optional `name`

## Admin UI

The UI change belongs to `Administración > CMC`.

Add to the selected center detail:

- editable scan target fields: `primaryIp`, `scanSubnetCidr`
- `Escanear ahora` action
- latest job status
- pending findings list
- `Confirmar` and `Descartar` actions

Behavior:

- findings stay in the CMC admin workspace until confirmed or dismissed
- confirmed findings refresh the official `CenterAsset` inventory immediately
- failed jobs surface a clear operational message

This keeps discovery curation in the admin context and avoids turning `Monitoreo de Red` into an asset management screen.

## Monitoring And Observability Integration

No discovery actions are added to `Monitoreo de Red` in this phase.

That screen continues to:

- load official `CenterAsset` records
- include them in the correlated inventory model
- reflect newly confirmed CMC assets once they are official

Optional backlog counters may be added later, but they are not required for this phase.

## Permissions

Restrict CMC discovery actions to administrative users.

Recommended permission:

- `MANAGE_ORG`

Protected operations:

- run CMC discovery
- confirm discovered CMC devices
- dismiss discovered CMC devices
- edit CMC scan target fields

## Error Handling

The API must fail clearly when:

- the CMC has neither `primaryIp` nor `scanSubnetCidr`
- `scanSubnetCidr` is invalid
- `primaryIp` is invalid
- `whosthere` execution fails
- `whosthere` returns malformed output

Expected job behavior:

- create the job as `RUNNING`
- transition to `COMPLETED` on success
- transition to `FAILED` with `errorMessage` on failure

The UI must display:

- failed job status
- a user-facing error message
- preserved previous findings when applicable

## Testing

Minimum required automated tests:

- `whosthere` output normalization
- target validation for `primaryIp` and `scanSubnetCidr`
- successful creation of `CenterDiscoveryJob`
- persistence of normalized `CenterDiscoveredDevice` rows
- confirm creates new `CenterAsset`
- confirm merges into existing `CenterAsset`
- dismiss updates status to `DISMISSED`
- monitoring center detail includes discovery backlog

## Risks And Tradeoffs

### Accepted Tradeoff

We are intentionally duplicating the discovery structure used by nodes instead of abstracting both flows into a generic engine.

Cost:

- more tables
- more endpoints
- more service code

Benefit:

- lower production risk
- simpler reasoning
- cleaner separation between field topology and CMC infrastructure
- easier staged rollout

### Deferred Work

The following remains intentionally deferred:

- center-level telemetry correlation for CMC assets
- dedicated Grafana discovery metrics for CMC jobs
- generic discovery framework shared by nodes and CMC

## Implementation Direction

The implementation should follow the current node discovery patterns wherever possible:

- dedicated service and controller
- command wrapper script
- normalized findings
- explicit confirm and dismiss flow
- immediate promotion into official assets after confirmation

The result should be operationally familiar to the team while preserving the domain boundary between node assets and CMC assets.
