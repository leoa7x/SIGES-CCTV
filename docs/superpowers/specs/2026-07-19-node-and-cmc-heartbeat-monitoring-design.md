# Node And CMC Heartbeat Monitoring Design

Date: 2026-07-19

## Objective

Add immediate reachability monitoring for nodes and monitoring centers so the system raises an alert shortly after a primary device stops responding, without scanning full subnets on every cycle.

This design separates two concerns that are currently mixed:

- `heartbeat`: fast health detection for known primary devices and known assets
- `discovery`: slower inventory refresh to find new devices or topology changes

## Current State

- `MonitoringCenter` already supports discovery scans and has an optional scheduler via `CENTER_MONITORING_INTERVAL_MS`.
- `Node` supports manual discovery jobs, but has no periodic discovery or heartbeat scheduler.
- `Node` and `MonitoringCenter` both store `primaryIp`.
- `NodeAsset` and `CenterAsset` can store their own IPs independently.
- Network monitoring alerts currently emphasize telemetry silence (`NODE_SILENT`, `ASSET_SILENT`), not immediate IP reachability.

## Problem

Today, turning off a real device like a cellphone-backed test node does not generate a quick operational alert by itself. The system only reflects the outage when a discovery or telemetry-related flow happens later.

That is too slow and too indirect for operational monitoring.

## Recommended Approach

Use lightweight heartbeat checks against known IPs, not subnet-wide scans.

Primary object checks:

- `Node.primaryIp` determines whether the node itself is reachable.
- `MonitoringCenter.primaryIp` determines whether the CMC itself is reachable.

Child asset checks:

- `NodeAsset.ip` determines whether a confirmed node asset is reachable.
- `CenterAsset.ip` determines whether a confirmed center asset is reachable.

Discovery remains separate:

- subnet scans stay responsible for inventory
- heartbeat stays responsible for immediate health and alerting

## Why This Approach

Compared with running full discovery repeatedly:

- it generates much less traffic
- it gives more predictable timing
- it scales better as node and asset counts grow
- it avoids conflating “device disappeared from inventory” with “device is temporarily unreachable”

## Monitoring Model

### Layer 1: Primary Object Health

Checks:

- every `15s`
- one probe per `Node.primaryIp`
- one probe per `MonitoringCenter.primaryIp`

State transitions:

- success: object is `ONLINE`
- first consecutive failure: keep internal failure count but do not immediately flap the public state
- second consecutive failure: mark object `OFFLINE` and raise alert
- first success after failure: resolve alert, reset failure count, return object to `ONLINE`

### Layer 2: Child Asset Health

Checks:

- every `15s`
- one probe per confirmed asset IP

State transitions:

- same failure/recovery behavior as the primary object
- separate alert identity from the parent object

### Layer 3: Discovery

No change in purpose:

- used to discover new or changed devices
- not used as the immediate outage detector

Discovery cadence should remain much slower than heartbeat cadence.

## Reachability Method

Use a lightweight reachability probe per IP.

Preferred behavior:

- try a simple network-level liveness check first
- keep timeout short
- avoid long blocking operations
- cap concurrency so many nodes do not spawn unlimited checks at once

Implementation may use the existing runtime environment and available network tools, but the service contract should be “reachable / unreachable within a short timeout”, not “full discovery”.

## Alert Model

Add explicit reachability alerts distinct from telemetry silence alerts.

New alert identities:

- `NODE_UNREACHABLE`
- `CENTER_UNREACHABLE`
- `NODE_ASSET_UNREACHABLE`
- `CENTER_ASSET_UNREACHABLE`

Required behavior:

- one active alert per affected object/asset
- no duplicate alerts on every cycle
- `lastSeenAt` refreshes while the outage remains active
- `resolvedAt` is set when reachability returns

Telemetry silence alerts remain valid and separate. A node can be:

- reachable but telemetry-silent
- unreachable entirely

These must not overwrite each other.

## Data Changes

Minimal persistence additions are recommended to support stable monitoring:

- heartbeat failure counters for nodes and centers
- heartbeat failure counters for node assets and center assets
- last successful heartbeat timestamp
- last attempted heartbeat timestamp

These can live either:

- directly on the main tables if the team wants simple operational fields
- or in dedicated heartbeat status tables if isolation is preferred

Recommendation:

- keep it simple and store minimal heartbeat state directly on the monitored entities unless Prisma/model complexity forces separation

## Scheduler Design

Introduce a dedicated scheduler for heartbeat monitoring.

Recommended intervals:

- `HEARTBEAT_INTERVAL_MS=15000`
- `HEARTBEAT_FAILURE_THRESHOLD=2`

Scheduler responsibilities:

- collect all monitored IPs
- run bounded-concurrency reachability checks
- update entity state only when thresholds are crossed
- upsert or resolve alerts
- emit state change events for the UI

Scheduler groups:

- node primary heartbeat scheduler
- center primary heartbeat scheduler
- optionally a shared asset heartbeat scheduler if code reuse is cleaner

Recommendation:

- shared heartbeat service
- thin schedulers for nodes, centers, and assets

## UI Expectations

Monitoring views should reflect reachability alerts quickly.

Required UI behavior:

- node monitoring shows primary-node outage alert without waiting for manual discovery
- CMC monitoring shows primary-center outage alert without waiting for manual discovery
- alerts tab distinguishes:
  - unreachable
  - telemetry-silent
- inventory cards reflect current `ONLINE/OFFLINE` state from heartbeat

## Failure And Safety Rules

- Missing `primaryIp` means “not heartbeat-monitored”; do not fail the cycle.
- Missing child asset IP means asset is excluded from heartbeat checks.
- One scheduler failure must not stop the next cycle.
- Slow probes must timeout quickly.
- Checks must not trigger full-subnet scans.
- Alert creation must be idempotent.

## Real Test Plan

### Node Test

Test object already created:

- route: `RUTA-CEL-19216816`
- node: `NODO-CEL-001`
- node IP: `192.168.1.6`

Validation flow:

1. Confirm node starts reachable and `ONLINE`.
2. Turn off the cellphone Wi-Fi.
3. Wait for two heartbeat failures.
4. Confirm:
   - node state becomes `OFFLINE`
   - `NODE_UNREACHABLE` alert appears
   - UI reflects the outage
5. Turn Wi-Fi back on.
6. Confirm:
   - first successful heartbeat resolves the alert
   - node returns to `ONLINE`

### CMC Test

Use:

- `demo-center-001`
- `primaryIp = 192.168.1.1`

Validation flow:

1. Confirm center starts reachable.
2. Simulate or use a real unreachable primary target when available.
3. Wait for two failed heartbeat cycles.
4. Confirm:
   - center-level outage alert appears
   - center returns to `ONLINE` when reachability resumes

## Implementation Scope

This phase includes:

- heartbeat scheduler(s)
- bounded reachability checks
- state transitions for nodes and centers
- alert creation/resolution
- UI reuse of resulting state/alerts
- real validation with the cellphone node

This phase does not include:

- replacing discovery
- changing Grafana dashboards first
- rewriting telemetry ingestion
- advanced SLA analytics

## Open Decisions Already Resolved

Chosen:

- use heartbeat against `primaryIp` for primary node/CMC state
- use per-asset IP heartbeat for confirmed child assets
- keep discovery separate
- use fast interval + small failure threshold

Chosen defaults:

- interval: `15s`
- failure threshold: `2`
- recovery threshold: `1` success
