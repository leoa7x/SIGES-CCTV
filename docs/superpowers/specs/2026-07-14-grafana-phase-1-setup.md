# Grafana Phase 1 Setup

## Scope

Phase 1 keeps SIGES as the operational shell and source of truth. Grafana reads
the SQL views created by `20260714110000_grafana_observability_views`; it must
not query application tables directly or derive asset correlation, discovery
state, or alerts.

## PostgreSQL Data Source

1. In Grafana, create a PostgreSQL data source for the SIGES database.
2. Use a dedicated read-only PostgreSQL role with `CONNECT` on the database,
   `USAGE` on schema `public`, and `SELECT` only on these views:
   `telemetry_node_summary_view`, `telemetry_node_timeseries_view`,
   `telemetry_asset_activity_view`, `telemetry_alerts_view`,
   `telemetry_discovery_backlog_view`, and `telemetry_global_health_view`.
3. Set the PostgreSQL data source time column to the query alias `time` where a
   panel query aliases `captured_at`, `last_seen_at`, or `first_seen_at`.
4. Keep Grafana internal. Phase 1 does not use anonymous public sharing, SSO,
   Prometheus, or Loki.

## Dashboard Variables

Create query variables using the PostgreSQL data source. Enable `Include All`
only for variables that are optional in a panel query.

| Variable | Query |
| --- | --- |
| `nodeId` | `SELECT node_id AS __value, node_code || ' - ' || node_name AS __text FROM telemetry_node_summary_view ORDER BY 2` |
| `routeId` | `SELECT DISTINCT route_id AS __value, route_identifier AS __text FROM telemetry_global_health_view ORDER BY 2` |
| `monitoringCenterId` | `SELECT DISTINCT monitoring_center_id AS __value, monitoring_center_name AS __text FROM telemetry_global_health_view ORDER BY 2` |
| `projectId` | `SELECT DISTINCT project_id AS __value, project_name AS __text FROM telemetry_global_health_view ORDER BY 2` |
| `cityId` | `SELECT DISTINCT city_id AS __value, city_name AS __text FROM telemetry_global_health_view ORDER BY 2` |
| `severity` | `SELECT DISTINCT alert_severity AS __value, alert_severity AS __text FROM telemetry_alerts_view ORDER BY 1` |
| `classificationSource` | `SELECT DISTINCT classification_source AS __value, classification_source AS __text FROM telemetry_asset_activity_view ORDER BY 1` |

Use `${nodeId:sqlstring}` and the equivalent format for other variables in SQL.
For an optional variable, use a Grafana All value of `__all` and predicate
`('${routeId}' = '__all' OR route_id = ${routeId:sqlstring})`.

## Node Observability Dashboard

Create a dashboard named `Node Observability` with a required `nodeId`
variable. Configure the dashboard UID to match
`GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID`.

Use `telemetry_node_summary_view` for the node state, latest snapshot, traffic
totals, current alert counts, protocols, and destinations. Use
`telemetry_node_timeseries_view` for time-series panels. Example traffic query:

```sql
SELECT
  captured_at AS time,
  total_bytes_in AS "Bytes in",
  total_bytes_out AS "Bytes out"
FROM telemetry_node_timeseries_view
WHERE node_id = ${nodeId:sqlstring}
  AND $__timeFilter(captured_at)
ORDER BY time;
```

Use `telemetry_asset_activity_view` for asset activity and unmatched traffic.
Filter asset panels by `classification_source`; `UNMATCHED` is the unmatched
traffic indicator. Use `telemetry_alerts_view` for active alerts:

```sql
SELECT
  last_seen_at AS time,
  alert_severity,
  alert_kind,
  title,
  detail,
  node_asset_name
FROM telemetry_alerts_view
WHERE node_id = ${nodeId:sqlstring}
  AND is_active
  AND ('${severity}' = '__all' OR alert_severity = ${severity:sqlstring})
  AND $__timeFilter(last_seen_at)
ORDER BY time DESC;
```

Use `telemetry_discovery_backlog_view` for discovery job state and discovered
device backlog. Its `discovered_device_count` is the unresolved discovery queue.

## Network Command View

Create a dashboard named `Network Command View` with optional `cityId`,
`projectId`, `monitoringCenterId`, `routeId`, `nodeId`, and `severity` variables.
Configure the dashboard UID to match
`GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID`.

Use `telemetry_global_health_view` for fleet cards, health tables, route and
center breakdowns, latest telemetry, current alert counts, and discovery
backlog. Example fleet summary query:

```sql
SELECT
  COUNT(*) AS node_count,
  COUNT(*) FILTER (WHERE captured_at IS NULL) AS nodes_without_telemetry,
  SUM(active_alert_count) AS active_alert_count,
  SUM(critical_alert_count) AS critical_alert_count,
  SUM(discovered_device_count) AS discovery_backlog
FROM telemetry_global_health_view
WHERE ('${cityId}' = '__all' OR city_id = ${cityId:sqlstring})
  AND ('${projectId}' = '__all' OR project_id = ${projectId:sqlstring})
  AND ('${monitoringCenterId}' = '__all' OR monitoring_center_id = ${monitoringCenterId:sqlstring})
  AND ('${routeId}' = '__all' OR route_id = ${routeId:sqlstring})
  AND ('${nodeId}' = '__all' OR node_id = ${nodeId:sqlstring});
```

Use `telemetry_alerts_view` for alert heatmaps and silent-node or silent-asset
tables. Use `telemetry_asset_activity_view` for unmatched traffic and noisy
assets, and `telemetry_discovery_backlog_view` for discovery backlog by node,
route, or monitoring center.

## SIGES Embed Wiring

SIGES sends `var-nodeId` for the node dashboard and `var-routeId` for the
network dashboard. Grafana dashboard variable names must remain exactly
`nodeId` and `routeId` so those embed URLs filter the expected panels. SIGES
continues to control page access and navigation; Grafana is an embedded view.
