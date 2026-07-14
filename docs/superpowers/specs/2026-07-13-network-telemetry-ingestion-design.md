# Network Telemetry Ingestion Design

Date: 2026-07-13
Project: SIGES-CCTV
Scope: Node-level traffic telemetry ingestion for `/monitoring/network`

## Goal

Add a first production-ready telemetry pipeline for SIGES-CCTV that:

- accepts summarized network telemetry from an external collector every 60 seconds
- correlates telemetry with `Node`, `NodeAsset`, and unmatched discovery candidates
- stores node-level and asset-level historical snapshots
- exposes query endpoints for the network monitoring UI
- generates basic operational alerts from real telemetry instead of UI-derived placeholders

This design explicitly does not embed packet capture inside the Nest API and does not store PCAP or raw packet streams.

## Why This Approach

The system already has strong topology, inventory, discovery, and analytics primitives:

- `Node`
- `NodeAsset`
- `NodeDiscoveryJob`
- `NodeDiscoveredDevice`
- `AnalyticsCatalog`

The clean extension is to add telemetry as a separate bounded module that references those entities but does not overload discovery or monitor state-change responsibilities.

Using an external collector plus ingestion endpoint is preferred because:

- capture privileges stay outside the web API
- the collector can evolve independently
- ingestion remains stable even if the capture implementation changes
- multi-node deployment is easier later
- the monitoring UI can consume normalized telemetry instead of tool-specific payloads

## Scope Boundaries

### In Scope

- telemetry data model for 60-second snapshots
- ingestion endpoint for summarized snapshots
- correlation of telemetry to official assets and unmatched devices
- telemetry query endpoints for the monitor UI
- basic alert generation from stored telemetry
- frontend wiring from `/monitoring/network` to real telemetry endpoints

### Out of Scope

- raw packet capture storage
- PCAP upload or replay
- real-time streaming websockets
- ASN/geolocation enrichment
- embedded packet sniffing inside Nest
- long-term analytics or anomaly ML

## High-Level Architecture

### Components

1. External collector
2. API ingestion module
3. Telemetry persistence layer
4. Query and alert API
5. `/monitoring/network` frontend integration

### Data Flow

1. A collector captures or summarizes traffic for a node sensor window.
2. Every 60 seconds it sends one snapshot to `POST /network-telemetry/ingest`.
3. SIGES validates the payload and resolves the target `Node`.
4. SIGES stores a node-level snapshot.
5. SIGES stores asset-level samples for each observed IP/MAC.
6. SIGES correlates each sample to:
   - an official `NodeAsset`
   - or an unmatched telemetry observation
7. SIGES derives alerts from recent telemetry.
8. The monitoring UI reads summaries, timeseries, asset samples, and alerts from query endpoints.

## Domain Model

### `NetworkTelemetrySnapshot`

Represents one summarized capture window for one node.

Fields:

- `id`
- `nodeId`
- `capturedAt`
- `windowSeconds`
- `totalBytesIn`
- `totalBytesOut`
- `activeHosts`
- `activeFlows`
- `alertCount`
- `collectorId`
- `topProtocolsJson`
- `topDestinationsJson`
- `createdAt`

Notes:

- `capturedAt` is the collector window end time.
- `windowSeconds` is expected to be `60` in v1, but stored explicitly for future flexibility.
- `topProtocolsJson` and `topDestinationsJson` remain JSON in v1 to avoid premature schema fragmentation.

### `NetworkTelemetryAssetSample`

Represents one observed host/device within one snapshot.

Fields:

- `id`
- `snapshotId`
- `nodeId`
- `nodeAssetId` nullable
- `ip` nullable
- `mac` nullable
- `hostname` nullable
- `bytesIn`
- `bytesOut`
- `flowCount`
- `lastSeenAt`
- `classificationSource`
- `createdAt`

`classificationSource` values:

- `OFFICIAL`
- `DISCOVERY`
- `UNMATCHED`

Notes:

- `nodeAssetId` is set only when correlation succeeds to an official asset.
- `DISCOVERY` means the sample matched a discovered device candidate but not an official asset.
- `UNMATCHED` means no reliable correlation exists yet.

### `NetworkTelemetryAlert`

Represents an operational alert derived from telemetry.

Fields:

- `id`
- `nodeId`
- `snapshotId` nullable
- `nodeAssetId` nullable
- `kind`
- `severity`
- `title`
- `detail`
- `firstSeenAt`
- `lastSeenAt`
- `isActive`
- `resolvedAt` nullable
- `metadataJson`

Alert kinds in v1:

- `NODE_SILENT`
- `ASSET_SILENT`
- `UNMATCHED_TRAFFIC`
- `NEW_DESTINATION`

## Ingestion Contract

### Endpoint

`POST /network-telemetry/ingest`

### Authentication

V1 should use a shared bearer token configured for collectors. This is separate from user JWT auth.

Headers:

- `Authorization: Bearer <collector-token>`

### Request Body

```json
{
  "nodeId": "uuid",
  "collectorId": "sensor-nodo-norte",
  "capturedAt": "2026-07-13T20:01:00.000Z",
  "windowSeconds": 60,
  "totals": {
    "bytesIn": 1240032,
    "bytesOut": 892114,
    "activeHosts": 6,
    "activeFlows": 41
  },
  "protocols": [
    { "name": "RTSP", "bytes": 930000, "flowCount": 8 },
    { "name": "HTTPS", "bytes": 220000, "flowCount": 16 }
  ],
  "destinations": [
    { "target": "192.168.1.10", "kind": "IP", "bytes": 850000, "flowCount": 7 },
    { "target": "pool.ntp.org", "kind": "DOMAIN", "bytes": 24000, "flowCount": 4 }
  ],
  "assets": [
    {
      "ip": "192.168.1.20",
      "mac": "AA:BB:CC:DD:EE:01",
      "hostname": "ptz-norte",
      "bytesIn": 600000,
      "bytesOut": 420000,
      "flowCount": 11,
      "lastSeenAt": "2026-07-13T20:00:58.000Z"
    }
  ]
}
```

### Validation Rules

- `nodeId` must exist.
- `windowSeconds` must be positive and expected to be `60` for v1.
- `capturedAt` must be a valid ISO timestamp.
- protocol and destination entries must have non-negative numeric counters.
- each asset sample must have at least one of `ip` or `mac`.
- duplicate asset samples within one payload should be rejected or normalized before persistence.

## Correlation Rules

Correlation priority for each asset sample:

1. exact `mac` to `NodeAsset.mac`
2. exact `ip` within the same node to `NodeAsset.ip`
3. fallback exact `mac` to recent `NodeDiscoveredDevice.mac`
4. fallback exact `ip` to recent `NodeDiscoveredDevice.ip`
5. otherwise mark as `UNMATCHED`

V1 does not auto-create official assets from telemetry.

V1 does not merge telemetry samples into discovery records automatically.

## API Queries

### `GET /network-telemetry/nodes/:id/summary`

Returns:

- latest snapshot metadata
- total bytes in/out
- active hosts
- active flows
- alert count
- latest top protocols
- latest top destinations

Used by:

- network monitor header cards
- traffic pulse strip

### `GET /network-telemetry/nodes/:id/timeseries`

Returns recent series for:

- timestamps
- bytes in/out
- active hosts
- active flows

Used by:

- trend charts

### `GET /network-telemetry/nodes/:id/assets`

Returns the most recent asset sample set with correlation metadata:

- official asset reference if matched
- unmatched or discovery classification otherwise
- bytes in/out
- flow count
- last seen

Used by:

- asset activity cards
- correlated inventory enhancements

### `GET /network-telemetry/nodes/:id/alerts`

Returns active alerts for the node.

Used by:

- alert tab
- future notification surfaces

## Alert Rules V1

### `NODE_SILENT`

Trigger:

- no telemetry snapshot for the node within `2 * windowSeconds`

Severity:

- `critical`

### `ASSET_SILENT`

Trigger:

- official asset exists with IP or MAC but has not appeared in telemetry for N recent snapshots

Default threshold:

- 5 consecutive snapshots

Severity:

- `warning`

### `UNMATCHED_TRAFFIC`

Trigger:

- telemetry asset sample cannot be matched to official asset or recent discovery candidate

Severity:

- `info`

### `NEW_DESTINATION`

Trigger:

- destination not seen in a rolling baseline window for that node

Baseline in v1:

- last 24 hours of stored destinations

Severity:

- `warning`

## Backend Module Structure

New module:

- `apps/api/src/network-telemetry/`

Suggested files:

- `network-telemetry.module.ts`
- `network-telemetry.controller.ts`
- `network-telemetry.service.ts`
- `network-telemetry.ingest.dto.ts`
- `network-telemetry.types.ts`
- `network-telemetry.alerts.ts`
- `network-telemetry.service.test.ts`

Responsibilities:

- controller
  - ingestion and queries
- service
  - validation orchestration
  - persistence
  - correlation
  - query shaping
- alerts helper
  - deterministic alert derivation logic

## Frontend Integration

`/monitoring/network` should stop deriving traffic visuals from discovery placeholders and instead call:

- summary endpoint
- timeseries endpoint
- assets endpoint
- alerts endpoint

The existing UI structure stays valid:

- `Inventario`
- `Tráfico / Observabilidad`
- `Alertas`

Only the traffic and alerts tabs need to switch from derived local model data to telemetry-backed API data.

## Testing Strategy

### Backend

- ingest DTO validation tests
- correlation tests
- snapshot persistence tests
- query projection tests
- alert derivation tests

### Frontend

- monitor model adapter tests if frontend aggregation remains necessary
- page build validation
- endpoint wiring smoke tests

### Verification Commands

- `npm run build --workspace=apps/api`
- targeted telemetry tests
- `npm run build --workspace=apps/web`

## Migration and Retention

Initial migration adds:

- `NetworkTelemetrySnapshot`
- `NetworkTelemetryAssetSample`
- `NetworkTelemetryAlert`
- related enums

Retention for v1:

- keep all telemetry data initially
- no cleanup worker in the first implementation

This is acceptable for v1 because the first goal is correctness and observability, not long-term storage optimization.

Retention cleanup can be added later once real volume is observed.

## Risks and Tradeoffs

### JSON vs normalized protocol/destination tables

V1 uses JSON for top protocols and top destinations because:

- it is faster to implement
- query needs are simple in the first version
- normalization can wait until the shape of real data is known

Tradeoff:

- less flexibility for deep analytics queries

### Collector trust boundary

The collector is trusted to summarize traffic honestly. V1 does not independently verify packet truth.

Tradeoff:

- simpler architecture
- weaker source verification

### No raw traffic retention

This prevents forensic replay from SIGES itself.

Tradeoff:

- much lower storage and implementation cost
- reduced deep-dive capability

## Recommended Implementation Order

1. Prisma schema and migration
2. telemetry module skeleton
3. ingest DTO and service
4. correlation logic
5. summary/timeseries/assets/alerts query endpoints
6. wire `/monitoring/network` traffic and alert tabs to live telemetry
7. add collector token config

## Success Criteria

The design is considered successful when:

- a collector can post one snapshot per minute for a node
- SIGES stores the snapshot and correlated samples
- `/monitoring/network` shows real timeseries and alert data for that node
- unmatched traffic is visible as operational signal
- silent assets and stale nodes produce alerts
