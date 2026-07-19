# ntopng And External Discovery Design

Date: 2026-07-19
Project: SIGES-CCTV
Scope: Integrate `ntopng` into `/monitoring/network`, remove mock discovery behavior from production flows, and add a separate category for out-of-subnet findings.

## Goal

Extend SIGES-CCTV network monitoring so that:

- `/monitoring/network` includes an embedded `ntopng` traffic view
- the system shows operational signals for "sin línea", "sin tráfico", and "caído"
- discovery runs only with real scanners in production-like use, never with silent mock results
- hosts found outside the expected CMC subnet are stored and reviewed separately
- operators can confirm those external findings without polluting official CMC or node inventories

## Why This Approach

SIGES already has three useful foundations:

- official inventory for nodes and CMC equipment
- active discovery through `LAN_ORANGUTAN_CMD`
- telemetry-driven alerting for silent nodes and assets

`ntopng` is valuable as an additional traffic/visibility layer, not as a replacement for inventory or discovery. The clean design is:

- keep SIGES as the operational source of truth
- keep active discovery for inventory reachability
- add `ntopng` for continuous traffic visibility
- separate unexpected hosts into their own workflow

This avoids mixing:

- official assets
- discovered-but-unconfirmed assets
- external or out-of-subnet findings

## Scope Boundaries

### In Scope

- a new `Tráfico` tab inside `/monitoring/network`
- embedded `ntopng` view in that tab
- SIGES summary cards above the embed
- removal of silent mock fallback from real discovery execution paths
- persistence for out-of-subnet findings
- operator actions for pending external findings:
  - keep pending
  - ignore
  - confirm manually

### Out of Scope

- replacing Grafana
- replacing the current discovery stack with `ntopng`
- automatic conversion of external findings into official node or CMC assets
- passive packet capture inside NestJS
- distributed probe/agent deployment outside the SIGES host

## Current State

### Discovery

- CMC discovery uses `CenterDiscoveryService` with `LAN_ORANGUTAN_CMD`
- node discovery uses `NodeDiscoveryService` with `LAN_ORANGUTAN_CMD`
- there is also a `run_whosthere_scan.py` wrapper in the repo, but it is not the active path for CMC/node discovery
- current discovery services contain a mock fallback when the command template is absent

### Monitoring

- `/monitoring/network` already loads:
  - official inventory
  - telemetry summary
  - telemetry alerts
  - official CMC assets
- network telemetry already derives:
  - `NODE_SILENT`
  - `ASSET_SILENT`
  - unmatched traffic alerts

### Problem

The current model still lacks:

- an embedded continuous traffic layer
- a first-class place for out-of-subnet findings
- a strict distinction between real discovery and mock fallback in operational environments

## High-Level Architecture

### Components

1. Active discovery runner
2. `ntopng` traffic source
3. External findings persistence
4. Monitoring aggregation API
5. `/monitoring/network` UI tabs and actions

### Data Flow

1. A CMC scan runs through `LAN_ORANGUTAN_CMD`.
2. SIGES normalizes discovered hosts.
3. Hosts matching the expected subnet continue through normal CMC discovery reconciliation.
4. Hosts outside the configured subnet are stored as external findings.
5. `ntopng` provides live traffic visibility for the same operational network.
6. SIGES reads summarized `ntopng` context and exposes it in the `Tráfico` tab.
7. Operators review external findings separately from official inventory.

## Discovery Rules

### Production Discovery Rule

Production-like discovery must not silently return mock devices.

Behavior:

- if `LAN_ORANGUTAN_CMD` is not configured, the discovery request fails explicitly
- if the command fails, the job is marked `FAILED`
- if the command succeeds and finds zero hosts, the job is `COMPLETED` with zero results
- zero real findings are valid
- fake findings are not valid

### Development Mock Rule

If a mock mode is preserved at all, it must be explicit and opt-in through a dedicated environment flag such as:

- `DISCOVERY_ALLOW_MOCK=true`

Without that flag, discovery must fail hard when no real scanner is configured.

### Out-Of-Subnet Rule

For CMC scans:

- the expected subnet comes from `MonitoringCenter.scanSubnetCidr`
- if absent, it may derive from `primaryIp` exactly as today
- any discovered host outside that subnet is not merged into `CenterAsset`
- it is stored as an external finding

This includes hosts detected by:

- the direct discovery result
- neighbor enrichment
- targeted `nmap -Pn` re-probes
- future `ntopng` correlation

## Domain Model

### New Entity: `ExternalDiscoveryFinding`

Purpose:
Store hosts that were seen from the operational vantage point but do not belong to the expected subnet or do not map cleanly into official inventory.

Fields:

- `id`
- `centerId`
- `source`
- `ip`
- `mac`
- `vendor`
- `model`
- `hostname`
- `candidateType`
- `discoveryConfidence`
- `outsideExpectedSubnet`
- `expectedSubnetCidr`
- `observedFromTargetIp`
- `status`
- `firstSeenAt`
- `lastSeenAt`
- `lastDiscoveryJobId` nullable
- `notes`
- `createdAt`
- `updatedAt`

### `status` values

- `PENDING`
- `IGNORED`
- `CONFIRMED`

### `source` values

- `SCAN`
- `NTOPNG`
- `SCAN_AND_NTOPNG`

## Confirmation Model

External findings remain separate by default.

Operators can:

- leave them pending
- ignore them
- confirm them manually

Confirmed external findings still do not become `CenterAsset` or `NodeAsset` automatically. They move into the third operational category: confirmed external findings.

This preserves a clean boundary between:

- official managed inventory
- discovery pipeline state
- exceptional or suspicious network observations

## ntopng Integration

### UI Placement

Inside `/monitoring/network`, add a new tab:

- `Tráfico`

That tab contains:

1. SIGES summary section
2. External findings section
3. embedded `ntopng`

### SIGES Summary Section

Cards above the embed:

- active hosts
- hosts without recent traffic
- hosts outside expected subnet
- pending external findings

### External Findings Section

Table/list showing:

- IP
- MAC
- vendor
- hostname
- source
- first seen
- last seen
- status
- actions

Actions:

- `Confirmar`
- `Ignorar`
- `Mantener pendiente`

### Embed Section

Below the summary and findings list:

- embedded `ntopng` view
- secondary action: `Abrir ntopng completo`

### API Contract For Embed

Mirror the existing observability embed pattern:

- protected backend endpoint returns sanitized embed descriptor
- frontend uses descriptor rather than hardcoding tool URLs

This keeps the UI aligned with the current Grafana embedding model.

## Backend Changes

### Discovery Services

Update:

- `CenterDiscoveryService`
- `NodeDiscoveryService`

Required changes:

- remove silent mock fallback from default behavior
- fail when scanner command is missing unless explicit mock mode is enabled
- classify out-of-subnet CMC findings before inventory reconciliation
- persist external findings separately

### New Module

Add a bounded backend module for external findings, for example:

- `external-discovery`

Responsibilities:

- upsert findings
- list findings by center
- confirm/ignore/reopen actions
- correlate repeated sightings from scan and `ntopng`

### ntopng Integration Module

Add a small integration module, for example:

- `ntopng-observability`

Responsibilities:

- load configured base URL and embed settings
- expose sanitized descriptor for frontend embedding
- optionally provide summary snapshots SIGES can show above the embed

This module should not parse raw traffic itself in v1. It should be a bounded adapter, not a second telemetry engine.

## Frontend Changes

### `/monitoring/network`

Add:

- new tab `Tráfico`
- top-level summary cards
- external findings review block
- embedded `ntopng`

Preserve:

- `Inventario`
- `Alertas`

### Operator UX Rules

- official inventory remains in `Inventario`
- external findings never appear as official assets by default
- out-of-subnet status must be visually explicit
- traffic embed must not replace SIGES summaries; it complements them

## Failure Handling

### Discovery Failure

If real discovery cannot run:

- job becomes `FAILED`
- UI shows scanner/tooling error explicitly
- no synthetic hosts are returned

### ntopng Unavailable

If `ntopng` is down or unreachable:

- `Tráfico` tab still renders
- summary block shows the error state
- embed area shows a controlled unavailable message
- inventory and alerts tabs continue working

## Testing Strategy

### Backend

Add tests for:

- discovery fails when command is missing and mock mode is disabled
- out-of-subnet hosts are stored as external findings
- in-subnet hosts still follow normal reconciliation
- repeated sightings merge/update the same finding
- confirm/ignore actions update state correctly
- `ntopng` descriptor endpoint sanitizes output

### Frontend

Add tests for:

- new `Tráfico` tab rendering
- external findings stay separate from official inventory
- confirmation and ignore actions
- unavailable embed state

## Recommended Phasing

### Phase 1

- remove silent mock fallback from default discovery
- add `ExternalDiscoveryFinding`
- classify and store out-of-subnet findings

### Phase 2

- add `Tráfico` tab
- add `ntopng` embed descriptor and iframe
- add summary cards and external findings UI

### Phase 3

- correlate scan and `ntopng` sightings
- refine "sin línea / caído / sin tráfico" thresholds

## Recommendation

Implement this as an additive layer:

- keep real active discovery
- add `ntopng` embed inside `Monitoreo Red`
- treat out-of-subnet hosts as a separate operational category
- never return mock discovery data unless an explicit development flag enables it

This gives SIGES a stricter operational model and a better monitoring surface without collapsing inventory, discovery, and traffic into one ambiguous dataset.
