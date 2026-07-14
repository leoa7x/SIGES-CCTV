-- Stable read-only contracts for Grafana. SIGES remains responsible for
-- correlation, discovery state, and alert derivation before data reaches these views.

CREATE OR REPLACE VIEW telemetry_node_summary_view AS
SELECT
  n."id" AS node_id,
  n."code" AS node_code,
  n."name" AS node_name,
  n."operativeState" AS node_operative_state,
  r."id" AS route_id,
  r."identifier" AS route_identifier,
  mc."id" AS monitoring_center_id,
  mc."name" AS monitoring_center_name,
  p."id" AS project_id,
  p."name" AS project_name,
  c."id" AS city_id,
  c."name" AS city_name,
  s."id" AS snapshot_id,
  s."collectorId" AS collector_id,
  s."capturedAt" AS captured_at,
  s."windowSeconds" AS window_seconds,
  s."totalBytesIn" AS total_bytes_in,
  s."totalBytesOut" AS total_bytes_out,
  s."activeHosts" AS active_hosts,
  s."activeFlows" AS active_flows,
  s."alertCount" AS snapshot_alert_count,
  s."topProtocolsJson" AS top_protocols_json,
  s."topDestinationsJson" AS top_destinations_json,
  COALESCE(alerts.active_alert_count, 0) AS active_alert_count,
  COALESCE(alerts.critical_alert_count, 0) AS critical_alert_count,
  COALESCE(alerts.warning_alert_count, 0) AS warning_alert_count
FROM "Node" n
JOIN "Route" r ON r."id" = n."routeId"
JOIN "MonitoringCenter" mc ON mc."id" = r."monitoringCenterId"
JOIN "Project" p ON p."id" = mc."projectId"
JOIN "City" c ON c."id" = p."cityId"
LEFT JOIN LATERAL (
  SELECT ns.*
  FROM "NetworkTelemetrySnapshot" ns
  WHERE ns."nodeId" = n."id"
  ORDER BY ns."capturedAt" DESC, ns."id" DESC
  LIMIT 1
) s ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS active_alert_count,
    COUNT(*) FILTER (WHERE a."severity" = 'CRITICAL') AS critical_alert_count,
    COUNT(*) FILTER (WHERE a."severity" = 'WARNING') AS warning_alert_count
  FROM "NetworkTelemetryAlert" a
  WHERE a."nodeId" = n."id" AND a."isActive"
) alerts ON TRUE;

CREATE OR REPLACE VIEW telemetry_node_timeseries_view AS
SELECT
  s."id" AS snapshot_id,
  s."capturedAt" AS captured_at,
  s."windowSeconds" AS window_seconds,
  s."collectorId" AS collector_id,
  s."totalBytesIn" AS total_bytes_in,
  s."totalBytesOut" AS total_bytes_out,
  s."activeHosts" AS active_hosts,
  s."activeFlows" AS active_flows,
  s."alertCount" AS snapshot_alert_count,
  s."topProtocolsJson" AS top_protocols_json,
  s."topDestinationsJson" AS top_destinations_json,
  n."id" AS node_id,
  n."code" AS node_code,
  n."name" AS node_name,
  n."operativeState" AS node_operative_state,
  r."id" AS route_id,
  r."identifier" AS route_identifier,
  mc."id" AS monitoring_center_id,
  mc."name" AS monitoring_center_name,
  p."id" AS project_id,
  p."name" AS project_name,
  c."id" AS city_id,
  c."name" AS city_name
FROM "NetworkTelemetrySnapshot" s
JOIN "Node" n ON n."id" = s."nodeId"
JOIN "Route" r ON r."id" = n."routeId"
JOIN "MonitoringCenter" mc ON mc."id" = r."monitoringCenterId"
JOIN "Project" p ON p."id" = mc."projectId"
JOIN "City" c ON c."id" = p."cityId";

CREATE OR REPLACE VIEW telemetry_asset_activity_view AS
SELECT
  sample."id" AS sample_id,
  snapshot."capturedAt" AS captured_at,
  sample."lastSeenAt" AS last_seen_at,
  sample."bytesIn" AS bytes_in,
  sample."bytesOut" AS bytes_out,
  sample."flowCount" AS flow_count,
  sample."classificationSource" AS classification_source,
  sample."ip" AS observed_ip,
  sample."mac" AS observed_mac,
  sample."hostname" AS observed_hostname,
  n."id" AS node_id,
  n."code" AS node_code,
  n."name" AS node_name,
  r."id" AS route_id,
  r."identifier" AS route_identifier,
  mc."id" AS monitoring_center_id,
  mc."name" AS monitoring_center_name,
  p."id" AS project_id,
  p."name" AS project_name,
  c."id" AS city_id,
  c."name" AS city_name,
  asset."id" AS node_asset_id,
  asset."name" AS node_asset_name,
  asset."assetType" AS node_asset_type,
  asset."operativeState" AS node_asset_operative_state,
  asset."source" AS node_asset_source
FROM "NetworkTelemetryAssetSample" sample
JOIN "NetworkTelemetrySnapshot" snapshot ON snapshot."id" = sample."snapshotId"
JOIN "Node" n ON n."id" = sample."nodeId"
JOIN "Route" r ON r."id" = n."routeId"
JOIN "MonitoringCenter" mc ON mc."id" = r."monitoringCenterId"
JOIN "Project" p ON p."id" = mc."projectId"
JOIN "City" c ON c."id" = p."cityId"
LEFT JOIN "NodeAsset" asset ON asset."id" = sample."nodeAssetId";

CREATE OR REPLACE VIEW telemetry_alerts_view AS
SELECT
  a."id" AS alert_id,
  a."firstSeenAt" AS first_seen_at,
  a."lastSeenAt" AS last_seen_at,
  a."resolvedAt" AS resolved_at,
  a."createdAt" AS created_at,
  a."updatedAt" AS updated_at,
  a."isActive" AS is_active,
  a."kind" AS alert_kind,
  a."severity" AS alert_severity,
  a."title" AS title,
  a."detail" AS detail,
  a."metadataJson" AS metadata_json,
  snapshot."capturedAt" AS snapshot_captured_at,
  n."id" AS node_id,
  n."code" AS node_code,
  n."name" AS node_name,
  r."id" AS route_id,
  r."identifier" AS route_identifier,
  mc."id" AS monitoring_center_id,
  mc."name" AS monitoring_center_name,
  p."id" AS project_id,
  p."name" AS project_name,
  c."id" AS city_id,
  c."name" AS city_name,
  asset."id" AS node_asset_id,
  asset."name" AS node_asset_name,
  asset."assetType" AS node_asset_type
FROM "NetworkTelemetryAlert" a
JOIN "Node" n ON n."id" = a."nodeId"
JOIN "Route" r ON r."id" = n."routeId"
JOIN "MonitoringCenter" mc ON mc."id" = r."monitoringCenterId"
JOIN "Project" p ON p."id" = mc."projectId"
JOIN "City" c ON c."id" = p."cityId"
LEFT JOIN "NetworkTelemetrySnapshot" snapshot ON snapshot."id" = a."snapshotId"
LEFT JOIN "NodeAsset" asset ON asset."id" = a."nodeAssetId";

CREATE OR REPLACE VIEW telemetry_discovery_backlog_view AS
SELECT
  n."id" AS node_id,
  n."code" AS node_code,
  n."name" AS node_name,
  r."id" AS route_id,
  r."identifier" AS route_identifier,
  mc."id" AS monitoring_center_id,
  mc."name" AS monitoring_center_name,
  p."id" AS project_id,
  p."name" AS project_name,
  c."id" AS city_id,
  c."name" AS city_name,
  latest_job."id" AS latest_discovery_job_id,
  latest_job."status" AS latest_discovery_job_status,
  latest_job."createdAt" AS latest_discovery_requested_at,
  latest_job."startedAt" AS latest_discovery_started_at,
  latest_job."finishedAt" AS latest_discovery_finished_at,
  COALESCE(backlog.pending_job_count, 0) AS pending_job_count,
  COALESCE(backlog.running_job_count, 0) AS running_job_count,
  COALESCE(backlog.failed_job_count, 0) AS failed_job_count,
  COALESCE(backlog.discovered_device_count, 0) AS discovered_device_count,
  COALESCE(backlog.confirmed_device_count, 0) AS confirmed_device_count,
  COALESCE(backlog.dismissed_device_count, 0) AS dismissed_device_count,
  COALESCE(backlog.merged_device_count, 0) AS merged_device_count
FROM "Node" n
JOIN "Route" r ON r."id" = n."routeId"
JOIN "MonitoringCenter" mc ON mc."id" = r."monitoringCenterId"
JOIN "Project" p ON p."id" = mc."projectId"
JOIN "City" c ON c."id" = p."cityId"
LEFT JOIN LATERAL (
  SELECT job.*
  FROM "NodeDiscoveryJob" job
  WHERE job."nodeId" = n."id"
  ORDER BY job."createdAt" DESC, job."id" DESC
  LIMIT 1
) latest_job ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT job."id") FILTER (WHERE job."status" = 'PENDING') AS pending_job_count,
    COUNT(DISTINCT job."id") FILTER (WHERE job."status" = 'RUNNING') AS running_job_count,
    COUNT(DISTINCT job."id") FILTER (WHERE job."status" = 'FAILED') AS failed_job_count,
    COUNT(device."id") FILTER (WHERE device."status" = 'DISCOVERED') AS discovered_device_count,
    COUNT(device."id") FILTER (WHERE device."status" = 'CONFIRMED') AS confirmed_device_count,
    COUNT(device."id") FILTER (WHERE device."status" = 'DISMISSED') AS dismissed_device_count,
    COUNT(device."id") FILTER (WHERE device."status" = 'MERGED') AS merged_device_count
  FROM "NodeDiscoveryJob" job
  LEFT JOIN "NodeDiscoveredDevice" device ON device."nodeDiscoveryJobId" = job."id"
  WHERE job."nodeId" = n."id"
) backlog ON TRUE;

CREATE OR REPLACE VIEW telemetry_global_health_view AS
SELECT
  summary.*,
  discovery.latest_discovery_job_status,
  discovery.latest_discovery_requested_at,
  discovery.latest_discovery_finished_at,
  discovery.pending_job_count,
  discovery.running_job_count,
  discovery.failed_job_count,
  discovery.discovered_device_count,
  discovery.confirmed_device_count,
  discovery.dismissed_device_count,
  discovery.merged_device_count
FROM telemetry_node_summary_view summary
JOIN telemetry_discovery_backlog_view discovery ON discovery.node_id = summary.node_id;
