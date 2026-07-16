import assert from "node:assert/strict";
import test from "node:test";

import { getPendingCenterDiscoveries } from "./center-discovery-view";

test("returns unique discovered hosts across repeated jobs using MAC first", () => {
  const devices = getPendingCenterDiscoveries([
    {
      discoveredDevices: [
        {
          id: "dev-new",
          status: "DISCOVERED",
          ip: "172.16.45.10",
          mac: "AA:BB:CC:DD:EE:FF",
          hostname: "core-cmc",
          name: null,
          vendor: null,
          model: null,
          candidateType: "SWITCH",
          discoveryConfidence: 0.98,
          matchedAsset: null,
        },
      ],
    },
    {
      discoveredDevices: [
        {
          id: "dev-old",
          status: "DISCOVERED",
          ip: "172.16.45.10",
          mac: "aa:bb:cc:dd:ee:ff",
          hostname: "core-cmc",
          name: null,
          vendor: null,
          model: null,
          candidateType: "SWITCH",
          discoveryConfidence: 0.7,
          matchedAsset: null,
        },
        {
          id: "dev-confirmed",
          status: "CONFIRMED",
          ip: "172.16.45.11",
          mac: "11:22:33:44:55:66",
          hostname: "ignored",
          name: null,
          vendor: null,
          model: null,
          candidateType: "SWITCH",
          discoveryConfidence: 0.5,
          matchedAsset: null,
        },
      ],
    },
  ]);

  assert.equal(devices.length, 1);
  assert.equal(devices[0]?.id, "dev-new");
});

test("falls back to IP-based dedupe when MAC is missing", () => {
  const devices = getPendingCenterDiscoveries([
    {
      discoveredDevices: [
        {
          id: "dev-new",
          status: "DISCOVERED",
          ip: "172.16.45.20",
          mac: null,
          hostname: "edge-1",
          name: null,
          vendor: null,
          model: null,
          candidateType: "SWITCH",
          discoveryConfidence: 0.92,
          matchedAsset: null,
        },
      ],
    },
    {
      discoveredDevices: [
        {
          id: "dev-old",
          status: "DISCOVERED",
          ip: "172.16.45.20",
          mac: null,
          hostname: "edge-1-old",
          name: null,
          vendor: null,
          model: null,
          candidateType: "SWITCH",
          discoveryConfidence: 0.6,
          matchedAsset: null,
        },
      ],
    },
  ]);

  assert.equal(devices.length, 1);
  assert.equal(devices[0]?.id, "dev-new");
});
