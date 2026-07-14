import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNetworkMonitorModel,
  formatTelemetryBytes,
  telemetryAlertLevel,
  type MonitorNodeDetail,
  type MonitorNodeListItem,
} from "./network-monitor";

test("telemetry helpers format serialized counters and API alert severities", () => {
  assert.equal(formatTelemetryBytes("0"), "0 B");
  assert.equal(formatTelemetryBytes("1536"), "1.5 KB");
  assert.equal(formatTelemetryBytes("1048576"), "1 MB");
  assert.equal(telemetryAlertLevel("CRITICAL"), "critical");
  assert.equal(telemetryAlertLevel("WARNING"), "warning");
  assert.equal(telemetryAlertLevel("INFO"), "info");
});

test("buildNetworkMonitorModel merges official inventory, discovery and alerts for a node monitor view", () => {
  const nodes: MonitorNodeListItem[] = [
    {
      id: "node-1",
      code: "N-001",
      name: "Nodo Norte",
      primaryIp: "192.168.1.1",
      scanSubnetCidr: "192.168.1.0/24",
      operativeState: "ONLINE",
      route: { identifier: "RUTA-1", center: { name: "CMC Norte" } },
      _count: { assets: 2, discoveryJobs: 3, analyticsAssignments: 1 },
    },
    {
      id: "node-2",
      code: "N-002",
      name: "Nodo Sur",
      primaryIp: null,
      scanSubnetCidr: null,
      operativeState: "OFFLINE",
      route: { identifier: "RUTA-2", center: { name: "CMC Sur" } },
      _count: { assets: 1, discoveryJobs: 0, analyticsAssignments: 0 },
    },
  ];

  const detail: MonitorNodeDetail = {
    id: "node-1",
    code: "N-001",
    name: "Nodo Norte",
    primaryIp: "192.168.1.1",
    scanSubnetCidr: "192.168.1.0/24",
    operativeState: "ONLINE",
    route: { identifier: "RUTA-1", center: { name: "CMC Norte" } },
    analyticsAssignments: [{ id: "an-1", analyticsCatalog: { id: "c1", code: "LPR", name: "LPR" } }],
    assets: [
      {
        id: "asset-1",
        assetType: "CAMARA_PTZ",
        name: "PTZ Norte",
        ip: "192.168.1.20",
        mac: "AA:BB",
        vendor: "Hikvision",
        model: "DS-2DE",
        hostname: "ptz-norte",
        operativeState: "ONLINE",
        lastSeenAt: null,
        analyticsAssignments: [],
      },
      {
        id: "asset-2",
        assetType: "SWITCH",
        name: "Switch Norte",
        ip: null,
        mac: null,
        vendor: "Cisco",
        model: null,
        hostname: null,
        operativeState: "OFFLINE",
        lastSeenAt: null,
        analyticsAssignments: [{ id: "an-2", analyticsCatalog: { id: "c2", code: "OTHER", name: "Otro" } }],
      },
    ],
    discoveryJobs: [
      {
        id: "job-1",
        status: "COMPLETED",
        targetSubnetCidr: "192.168.1.0/24",
        createdAt: "2026-07-13T10:00:00.000Z",
        discoveredDevices: [
          {
            id: "disc-1",
            candidateType: "CAMARA_FIJA",
            name: "Camara Patio",
            ip: "192.168.1.30",
            mac: "CC:DD",
            vendor: "Hikvision",
            model: null,
            hostname: "cam-patio",
            discoveryConfidence: 80,
            status: "DISCOVERED",
          },
          {
            id: "disc-2",
            candidateType: "UPS",
            name: "UPS Nodo",
            ip: "192.168.1.40",
            mac: "EE:FF",
            vendor: "APC",
            model: null,
            hostname: "ups-norte",
            discoveryConfidence: 60,
            status: "DISMISSED",
          },
        ],
      },
    ],
  };

  const model = buildNetworkMonitorModel(nodes, detail);

  assert.equal(model.summary.totalNodes, 2);
  assert.equal(model.summary.onlineNodes, 1);
  assert.equal(model.summary.offlineNodes, 1);
  assert.equal(model.summary.officialAssets, 3);
  assert.equal(model.inventory.length, 3);
  assert.equal(model.inventory[2]?.source, "DISCOVERY");
  assert.equal(model.observability.officialDevicesWithIp, 1);
  assert.equal(model.observability.analyticsConfigured, 2);
  assert.equal(model.observability.pendingDiscoveries, 1);
  assert.deepEqual(model.observability.topVendors, [
    { vendor: "Hikvision", count: 2 },
    { vendor: "Cisco", count: 1 },
  ]);
  assert.deepEqual(model.charts.assetTypeBreakdown, [
    { type: "CAMARA_PTZ", count: 1 },
    { type: "SWITCH", count: 1 },
  ]);
  assert.deepEqual(model.charts.stateBreakdown, [
    { state: "ONLINE", count: 2 },
    { state: "OFFLINE", count: 1 },
  ]);
  assert.deepEqual(model.charts.discoveryTrend, [
    { id: "job-1", label: "13 de jul", discovered: 1, confirmed: 0, dismissed: 1 },
  ]);
  assert.equal(model.alerts.some((alert) => alert.id === "asset-health"), true);
  assert.equal(model.alerts.some((alert) => alert.id === "pending-discovery"), true);
});

test("buildNetworkMonitorModel reports missing IP, subnet and analytics as alerts", () => {
  const model = buildNetworkMonitorModel([], {
    id: "node-2",
    code: "N-002",
    name: "Nodo Sur",
    primaryIp: null,
    scanSubnetCidr: null,
    operativeState: "OFFLINE",
    route: { identifier: "RUTA-2", center: { name: "CMC Sur" } },
    assets: [],
    discoveryJobs: [],
    analyticsAssignments: [],
  });

  assert.equal(model.alerts.some((alert) => alert.id === "missing-primary-ip"), true);
  assert.equal(model.alerts.some((alert) => alert.id === "missing-subnet"), true);
  assert.equal(model.alerts.some((alert) => alert.id === "missing-analytics"), true);
  assert.equal(model.observability.latestDiscoveryLabel, "Sin escaneos");
});
