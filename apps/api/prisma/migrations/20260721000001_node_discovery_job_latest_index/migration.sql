-- telemetry_discovery_backlog_view's "latest job per node" lateral
-- (ORDER BY "createdAt" DESC, id DESC LIMIT 1) had no index to serve it and
-- fell back to a per-node sequential scan + sort, confirmed via EXPLAIN.
CREATE INDEX "NodeDiscoveryJob_nodeId_createdAt_idx" ON "NodeDiscoveryJob"("nodeId", "createdAt");
