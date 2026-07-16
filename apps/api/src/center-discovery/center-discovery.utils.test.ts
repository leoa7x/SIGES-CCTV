import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCenterDiscoveredDevices, normalizeMacAddress } from "./center-discovery.utils";

test("normalizeCenterDiscoveredDevices maps WhosThere-like payloads into internal discovered devices", () => {
  const devices = normalizeCenterDiscoveredDevices([
    {
      ipAddress: "10.10.0.12",
      macAddress: "AA:BB:CC:00:11:22",
      manufacturer: "Cisco",
      deviceModel: "CBS250-24P-4G",
      hostName: "core-cmc",
      category: "switch",
      score: 88,
    },
  ]);

  assert.deepEqual(devices, [
    {
      candidateType: "SWITCH",
      name: "core-cmc",
      ip: "10.10.0.12",
      mac: "AA:BB:CC:00:11:22",
      vendor: "Cisco",
      model: "CBS250-24P-4G",
      hostname: "core-cmc",
      discoveryConfidence: 88,
      rawPayload: {
        ipAddress: "10.10.0.12",
        macAddress: "AA:BB:CC:00:11:22",
        manufacturer: "Cisco",
        deviceModel: "CBS250-24P-4G",
        hostName: "core-cmc",
        category: "switch",
        score: 88,
      },
    },
  ]);
});

test("normalizeMacAddress makes differently-formatted MACs comparable", () => {
  assert.equal(normalizeMacAddress("aa:bb:cc:00:11:22"), "AABBCC001122");
  assert.equal(normalizeMacAddress("AA-BB-CC-00-11-22"), "AABBCC001122");
  assert.equal(normalizeMacAddress(null), "");
  assert.equal(normalizeMacAddress(undefined), "");
});
