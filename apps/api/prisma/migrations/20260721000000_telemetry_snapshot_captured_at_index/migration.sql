-- Grafana's network-wide panels (telemetry_node_timeseries_view queried by
-- captured_at only, no node_id predicate) can't use the existing
-- (nodeId, capturedAt) composite index. Add a standalone index so that
-- access path doesn't fall back to a sequential scan as snapshots grow.
CREATE INDEX "NetworkTelemetrySnapshot_capturedAt_idx" ON "NetworkTelemetrySnapshot"("capturedAt");
