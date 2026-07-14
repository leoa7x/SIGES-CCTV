# SIGES Embedded Grafana Observability Design

Date: 2026-07-14
Status: Proposed

## Goal

Add embedded Grafana dashboards to SIGES so operators can analyze network telemetry, discovery signals, alert states, and node health from inside the existing SIGES workflows, without replacing the SIGES application shell.

## Outcome

SIGES remains the operational system of record for:

- nodes
- routes
- fiber
- splices
- official assets
- discovery workflows
- alert derivation
- business logic and operator actions

Grafana becomes the embedded observability layer for:

- network traffic visualization
- time-series telemetry
- alert overviews
- silent node and silent asset tracking
- unmatched traffic visibility
- discovery backlog visibility
- drill-down dashboards by node and globally

LAN-Orangutan remains an input source for discovery and network scan data. It does not become the place where business rules or alert decisions live.

## System Roles

### LAN-Orangutan

Responsibilities:

- scan the network
- detect hosts and basic network identity signals
- provide discovery-oriented raw data to SIGES

Non-responsibilities:

- no business correlation logic
- no official asset creation
- no dashboard ownership
- no direct Grafana integration

### SIGES

Responsibilities:

- ingest telemetry and discovery data
- correlate samples to `Node`, `NodeAsset`, and recent `NodeDiscoveredDevice`
- classify samples as `OFFICIAL`, `DISCOVERY`, or `UNMATCHED`
- derive alerts such as `NODE_SILENT`, `ASSET_SILENT`, and `UNMATCHED_TRAFFIC`
- store operational and observability data in PostgreSQL
- render the main operational UI and navigation
- control what dashboards are embedded and with which filters

SIGES is the only system that should decide operational truth.

### Grafana

Responsibilities:

- query prepared observability data
- render charts, tables, panels, and dashboards
- provide drill-down and time-range exploration

Non-responsibilities:

- no ownership of business logic
- no asset correlation logic
- no discovery-state decisions
- no direct management of nodes, routes, or topology

Grafana presents the results of decisions made by SIGES. It does not replace those decisions.

## Core Architectural Principle

The data path is:

`LAN-Orangutan -> SIGES -> PostgreSQL -> Grafana -> embedded inside SIGES`

Direct `LAN-Orangutan -> Grafana` integration is explicitly rejected because it would duplicate correlation logic and break traceability between network signals and SIGES entities.

## Phase 1 Recommendation

Phase 1 uses:

- SIGES as the main application shell
- embedded Grafana dashboards via `iframe`
- PostgreSQL as Grafana's initial data source

Phase 1 explicitly does not require:

- Prometheus
- Loki
- SSO with Grafana
- public Grafana sharing
- replacing SIGES views with raw Grafana navigation

This keeps the initial implementation practical and compatible with the current codebase.

## UX Integration

### Primary Embed: Node Detail

Add a new `Observabilidad` tab inside the node detail experience.

Purpose:

- diagnose a single node deeply
- keep operator context on the same node record
- combine operational context and observability in one workflow

Expected layout:

- SIGES node summary at the top
- quick context cards from SIGES
- Grafana embed filtered by `nodeId`

### Secondary Embed: Global Network Monitoring

Add Grafana-backed global observability blocks into `/monitoring/network`.

Purpose:

- support NOC-style fleet overview
- show aggregate traffic, alert density, discovery backlog, and unhealthy nodes

Expected layout:

- SIGES summary cards and control surface remain first
- Grafana provides heavier analytics and drill-down visuals

### UX Constraints

- SIGES remains the navigation shell
- Grafana is embedded, not treated as a separate product
- inventory views in SIGES remain based on the current correlated model
- dashboards must feel contextual, not like unrelated iframes pasted into the app

## Dashboard Set

### Dashboard 1: Node Observability

Used inside the node-level `Observabilidad` tab.

Required panels:

- node status
- latest snapshot age
- bytes in/out timeline
- active hosts timeline
- active flows timeline
- top protocols
- top destinations
- asset activity table
- silent asset overview
- discovery health
- active alerts
- unmatched traffic indicators

Required filters:

- `nodeId`
- time range
- severity
- asset type
- classification source

### Dashboard 2: Network Command View

Used inside `/monitoring/network`.

Required panels:

- fleet health summary
- aggregate traffic overview
- top noisy nodes
- alert heatmap
- silent nodes overview
- silent assets overview
- unmatched traffic overview
- discovery backlog
- breakdown by route
- breakdown by monitoring center

Required filters:

- project
- city
- monitoring center
- route
- node
- severity
- time range

## Data Boundaries

### Canonical Operational Data

These remain authoritative inside SIGES and are not re-modeled in Grafana:

- nodes
- official assets
- routes
- fiber
- splices
- discovery workflow state
- operator actions

### Observability Data To Expose

Grafana should consume the following prepared data:

- `NetworkTelemetrySnapshot`
- `NetworkTelemetryAssetSample`
- `NetworkTelemetryAlert`
- node operative state
- asset operative state
- discovery backlog counts
- analytics assignment counts when relevant for context

### Context Data To Join For Dashboard Filters

Grafana queries need enough context to filter and label results with:

- `nodeId`
- node code
- node name
- route id and identifier
- monitoring center id and name
- project id and name
- official asset id and name
- official asset type
- sample classification source

## Query Strategy

Grafana should not query arbitrary application tables directly from ad hoc panels wherever possible.

Preferred Phase 1 approach:

- create stable SQL views or tightly controlled SQL queries
- keep Grafana dashboards dependent on those stable observability-facing shapes

Recommended Phase 1 views:

- `telemetry_node_summary_view`
- `telemetry_node_timeseries_view`
- `telemetry_asset_activity_view`
- `telemetry_alerts_view`
- `telemetry_discovery_backlog_view`
- `telemetry_global_health_view`

Benefits:

- less schema coupling
- cleaner panel queries
- easier dashboard evolution later
- simpler move to materialized views or dedicated observability storage later

## Embedding Strategy

Phase 1 embedding should use Grafana dashboard or panel URLs rendered through a reusable SIGES component, for example a `GrafanaPanelEmbed`.

Expected inputs:

- dashboard identifier
- `nodeId`
- `routeId`
- `monitoringCenterId`
- time range
- theme

Behavior:

- SIGES builds the embed URL
- SIGES decides which variables are passed
- Grafana renders the requested filtered dashboard

## Authentication Strategy

Phase 1 recommendation:

- Grafana stays internal
- SIGES controls access to pages containing embeds
- no anonymous public dashboards

Production-hardening can later evolve toward a tighter model, but Phase 1 should avoid introducing complex SSO or fragile public-share flows before the operational value is proven.

## Phase Plan

### Phase 1: Minimum Useful Integration

- deploy Grafana
- connect Grafana to SIGES PostgreSQL
- define stable SQL views or equivalent controlled queries
- build `Node Observability`
- build `Network Command View`
- add `Observabilidad` tab to node detail
- add Grafana-backed block(s) to `/monitoring/network`
- keep SIGES cards and controls around the embeds

### Phase 2: Operational Hardening

- improve query performance
- refine filters and drill-downs
- add route and center dashboards
- improve role-based access patterns
- add better error and retry behavior in embeds
- consider materialized views if dashboard load requires them

### Phase 3: Advanced NOC/SOC

- add Prometheus if higher-frequency metrics are needed
- add Loki if log/event streams become important
- add advanced alerting and incident correlations
- add wallboard-style dashboards
- add SLA and trend reporting

## Explicit Non-Goals For Phase 1

- replacing SIGES UI with Grafana
- letting Grafana derive business truth
- sending LAN-Orangutan output directly to Grafana
- adding Prometheus or Loki before Phase 1 proves useful
- exposing Grafana publicly

## Success Criteria

Phase 1 is successful when all of the following are true:

- an operator can open a node and inspect embedded Grafana observability filtered to that node
- `/monitoring/network` shows embedded global observability panels
- telemetry, alert, and discovery context are visible without leaving SIGES
- SIGES remains the only place that decides correlation and alert rules
- no duplicated business logic appears in Grafana queries or LAN-Orangutan integration

## Risks And Mitigations

### Risk: duplicated logic between Grafana and SIGES

Mitigation:

- only expose prepared results
- keep alert derivation and correlation inside SIGES

### Risk: dashboard queries become tightly coupled to app schema

Mitigation:

- use views or tightly controlled SQL contracts

### Risk: embedded dashboards feel disconnected from the product

Mitigation:

- keep SIGES headers, cards, controls, and actions around the Grafana panels

### Risk: performance degradation on production data

Mitigation:

- start with PostgreSQL
- move to optimized views, materialized views, or Prometheus/Loki only when usage proves the need

## Final Recommendation

Adopt a hybrid model:

- `LAN-Orangutan` as a discovery and telemetry input source
- `SIGES` as the operational brain and system of record
- `Grafana` as the embedded observability engine
- `PostgreSQL` as the initial Grafana data source

This gives SIGES a more professional and practical observability surface without surrendering operational ownership to external tooling.
