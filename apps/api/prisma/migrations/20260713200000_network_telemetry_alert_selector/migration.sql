-- Deduplicate active alert identities through the selector used by telemetry ingestion.
CREATE UNIQUE INDEX "NetworkTelemetryAlert_nodeId_kind_title_key" ON "NetworkTelemetryAlert"("nodeId", "kind", "title");
