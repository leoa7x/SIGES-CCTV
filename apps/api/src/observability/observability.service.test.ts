import assert from "node:assert/strict";
import test from "node:test";

import { ObservabilityService } from "./observability.service";

const config = {
  baseUrl: "http://grafana.local",
  orgId: "1",
  dashboards: {
    "node-observability": "node-observability-uid",
    "network-command-view": "network-command-view-uid",
  },
};

test("getDashboardEmbed builds a node observability URL with nodeId and time range", () => {
  const service = new ObservabilityService(config);

  const result = service.getDashboardEmbed({
    dashboard: "node-observability",
    nodeId: "node-123",
    from: "now-6h",
    to: "now",
  });

  assert.equal(result.dashboard, "node-observability");
  assert.match(result.url, /node-observability-uid/);
  assert.match(result.url, /var-nodeId=node-123/);
  assert.match(result.url, /from=now-6h/);
  assert.match(result.url, /to=now/);
});

test("getDashboardEmbed builds a global network command view URL without nodeId", () => {
  const service = new ObservabilityService(config);

  const result = service.getDashboardEmbed({
    dashboard: "network-command-view",
    from: "now-24h",
    to: "now",
  });

  assert.equal(result.dashboard, "network-command-view");
  assert.match(result.url, /network-command-view-uid/);
  assert.doesNotMatch(result.url, /var-nodeId=/);
});

test("getDashboardEmbed includes routeId when provided", () => {
  const service = new ObservabilityService(config);

  const result = service.getDashboardEmbed({
    dashboard: "network-command-view",
    routeId: "route-456",
    from: "now-24h",
    to: "now",
  });

  assert.equal(result.dashboard, "network-command-view");
  assert.match(result.url, /var-routeId=route-456/);
});
