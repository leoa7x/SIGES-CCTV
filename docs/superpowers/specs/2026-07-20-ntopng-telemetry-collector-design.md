# ntopng Telemetry Collector Design

Date: 2026-07-20
Project: SIGES-CCTV
Scope: Real traffic collector from local `ntopng` into `POST /network-telemetry/ingest`

## Goal

Close the missing production gap between:

- real traffic observed on the SIGES host
- the existing `network-telemetry` ingestion module
- Grafana dashboards that currently expect real time-series data

This design adds a real collector process that reads summarized traffic from a local `ntopng` instance and publishes normalized snapshots to SIGES every fixed window.

## Why This Exists

SIGES already has:

- real discovery through `LAN-Orangutan`
- real reachability monitoring through the heartbeat/monitor flows
- a real persistence and query layer for network telemetry
- Grafana dashboards and monitor pages wired to consume telemetry-derived views

What it does not have yet is the real producer that fills `NetworkTelemetrySnapshot`.

That is why a real node such as `192.168.1.6` can exist in SIGES and still show empty throughput and availability graphs: the ingestion backend is ready, but there is no running collector feeding it.

## Recommended Approach

Use `ntopng` as the first real traffic source and add a bounded SIGES collector that translates `ntopng` observations into the already-defined ingestion contract.

This is preferred over building direct packet capture inside SIGES because:

- `ntopng` already solves traffic observation well
- SIGES keeps ownership of inventory correlation and operational semantics
- the API contract stays stable even if the traffic source changes later
- `LAN-Orangutan`, `whosthere`, heartbeat, telemetry, and Grafana keep clear responsibilities

## Scope Boundaries

### In Scope

- local `ntopng` deployment on the same SIGES server
- a SIGES collector process that polls `ntopng`
- normalization of `ntopng` observations into `network-telemetry` snapshots
- correlation of observed hosts to `Node`, `NodeAsset`, `MonitoringCenter`, and `CenterAsset`
- aggregation by node and monitoring center
- forwarding unmatched observations into `external-discovery`
- operational handling for `ntopng` unavailable or empty windows

### Out of Scope

- replacing `LAN-Orangutan` or `whosthere`
- replacing heartbeat reachability checks
- storing raw PCAP
- distributed collectors on remote probe hosts
- auto-creating official assets from passive traffic
- bypassing the existing `/network-telemetry/ingest` endpoint

## High-Level Architecture

### Runtime Components

1. Local `ntopng` service on the SIGES host
2. SIGES telemetry collector process
3. Existing NestJS `network-telemetry` ingestion endpoint
4. Existing telemetry tables and views
5. Existing Grafana dashboards and `/monitoring/network`

### Data Flow

1. `ntopng` observes hosts and traffic on the selected local interface.
2. Every fixed window, the SIGES collector reads summarized host traffic from `ntopng`.
3. The collector normalizes each observed host into a stable intermediate record:
   - IP
   - MAC
   - hostname
   - bytes in/out for the window
   - flow count
   - last seen time
4. The collector correlates each observed host to SIGES entities.
5. Correlated hosts are grouped by their operational owner:
   - node
   - monitoring center
6. The collector publishes one normalized snapshot per owner to `POST /network-telemetry/ingest`.
7. Unmatched or out-of-subnet hosts are also recorded through the external discovery flow.
8. Grafana and `/monitoring/network` read the resulting real time-series and alert views.

## Separation Of Responsibilities

### `LAN-Orangutan` and `whosthere`

- active discovery
- inventory enrichment
- subnet-aware scanning

### Heartbeat / monitor

- fast online/offline reachability
- immediate outage signaling

### `ntopng`

- passive traffic visibility
- real host activity and volume observation

### SIGES telemetry collector

- translates `ntopng` data into SIGES semantics
- correlates observed hosts to official entities
- aggregates by node and center
- publishes normalized snapshots

### `network-telemetry`

- persists snapshots
- builds time-series
- derives telemetry alerts
- serves monitoring and Grafana queries

## Correlation Rules

Observed hosts must be correlated deterministically and conservatively.

Priority order:

1. `NodeAsset.macAddress`
2. `CenterAsset.macAddress`
3. `NodeAsset.ipAddress`
4. `CenterAsset.ipAddress`
5. `Node.primaryIp`
6. `MonitoringCenter.primaryIp`

Rules:

- `MAC` is preferred over `IP` whenever both are available.
- A `MAC` match is considered stronger than any `IP` match.
- If both `MAC` and `IP` are present but point to different official entities, the host is treated as ambiguous and must not be forced into an official asset record.
- Ambiguous hosts go to unmatched/external handling, not to official telemetry ownership.
- The collector must never auto-create `NodeAsset` or `CenterAsset`.

## Aggregation Rules

Traffic is not assigned to one arbitrary host. It is aggregated from all correlated hosts in the same window.

### Node Aggregation

If multiple hosts belong to the same node:

- the node snapshot sums their `bytesIn`
- the node snapshot sums their `bytesOut`
- the node snapshot sums their `flowCount`
- `activeHosts` reflects the count of distinct correlated hosts for that node in the window

Each correlated host still appears as an asset-level sample in the snapshot payload.

### Monitoring Center Aggregation

If multiple hosts belong to the same monitoring center:

- the center-level operational summary sums all correlated center hosts
- each host remains individually attributable for drill-down and external discovery reconciliation

### Example

If these hosts belong to the same node:

- `192.168.1.6` mobile device
- `192.168.1.20` camera
- `192.168.1.30` switch

then the node-level throughput is:

- `totalBitsPerSecond = traffic(1.6) + traffic(1.20) + traffic(1.30)`

and the individual host contribution remains visible as separate asset samples.

## Unmatched And External Hosts

If an observed host cannot be matched to an official SIGES entity:

- it must not inflate official node or center totals
- it must be persisted as an unmatched finding
- if it sits outside the expected subnet, it must also be classified through `external-discovery`

This preserves the distinction between:

- official managed inventory
- traffic seen on the wire
- external or suspicious devices

## Collector Window And Scheduling

V1 uses a fixed collection window of 60 seconds.

Rules:

- one collection cycle reads `ntopng`, builds normalized host observations, then emits snapshots
- one cycle may produce zero, one, or many snapshots depending on what entities had correlated hosts
- empty windows are valid and must not be treated as collector failure
- transport or auth failure when posting to SIGES is a collector failure and must be logged explicitly

## Failure Handling

### `ntopng` Unavailable

If `ntopng` is down or unreachable:

- the collector does not invent zero traffic snapshots
- the collector records a hard failure
- SIGES keeps the last persisted telemetry and operational alerts continue to age naturally

### No Hosts Observed

If `ntopng` is reachable but returns no observed hosts in a window:

- the cycle is considered successful
- no fake traffic is generated
- silence remains a real operational signal

### Ingestion Rejected

If `/network-telemetry/ingest` rejects a payload:

- the collector logs the exact entity and error
- the cycle is marked failed for that payload
- other independent entity payloads in the same cycle may still continue

## Configuration

V1 needs explicit configuration for:

- `NTOPNG_BASE_URL`
- `NTOPNG_USERNAME` or token-equivalent auth if used
- `NTOPNG_PASSWORD` or token-equivalent auth if used
- `NETWORK_TELEMETRY_INGEST_URL`
- `NETWORK_TELEMETRY_INGEST_TOKEN`
- monitored local interface or site scope as required by `ntopng`
- collection interval, default `60`

The collector must fail clearly when the `ntopng` or ingest configuration is missing.

## Testing Strategy

### Unit Tests

- normalize one `ntopng` host into the SIGES internal host shape
- correlate by `MAC`
- correlate by `IP`
- reject ambiguous correlation
- aggregate multiple hosts into one node snapshot
- exclude unmatched hosts from official totals

### Integration Tests

- collector builds an ingest payload accepted by `network-telemetry`
- one cycle emits snapshots for multiple nodes
- out-of-subnet unmatched hosts are handed to external discovery
- `ntopng` unavailable path fails explicitly without fake data

### Operational Verification

With a real registered node such as `192.168.1.6` generating traffic:

- `NetworkTelemetrySnapshot` count increases over time
- Grafana timeseries stop being empty
- `/monitoring/network` shows changing throughput from real data

## Success Criteria

The design is successful when all of this is true:

- SIGES runs a real collector from local `ntopng`
- the collector publishes snapshots into the existing telemetry pipeline
- node and center traffic totals come from aggregated correlated hosts
- unmatched traffic is preserved separately, not forced into official inventory
- Grafana panels read real time-series instead of empty datasets
- no mock traffic or fake snapshots are introduced anywhere in production flow
