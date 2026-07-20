-- Add composite indexes for filter/sort patterns already used by the
-- application (incident dashboards, per-node logbook history, per-device
-- audit trail, and per-center/node discovery job polling) so these tables
-- don't degrade to sequential scans as they grow.

CREATE INDEX "Incident_status_detectedAt_idx" ON "Incident"("status", "detectedAt");
CREATE INDEX "Incident_centerId_status_idx" ON "Incident"("centerId", "status");

CREATE INDEX "LogbookEntry_nodeId_date_idx" ON "LogbookEntry"("nodeId", "date");

CREATE INDEX "DeviceStateLog_entityType_entityId_createdAt_idx" ON "DeviceStateLog"("entityType", "entityId", "createdAt");

CREATE INDEX "CenterDiscoveryJob_centerId_status_idx" ON "CenterDiscoveryJob"("centerId", "status");

CREATE INDEX "NodeDiscoveryJob_nodeId_status_idx" ON "NodeDiscoveryJob"("nodeId", "status");
