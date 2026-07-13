import assert from "node:assert/strict";
import test from "node:test";

import { deriveSubnetFromIp, normalizeDiscoveredDevices } from "./node-discovery.utils";

test("deriveSubnetFromIp falls back to /24 for a node primary IP", () => {
  assert.equal(deriveSubnetFromIp("192.168.10.55"), "192.168.10.0/24");
});

test("normalizeDiscoveredDevices maps raw Orangutan-like payloads into temporary discovered devices", () => {
  const devices = normalizeDiscoveredDevices([
    {
      ip: "192.168.10.101",
      mac: "AA:BB:CC:DD:EE:FF",
      vendor: "Hikvision",
      hostname: "cam-norte",
      model: "DS-2DE2A404IW-DE3",
      type: "camera_ptz",
      confidence: 92,
    },
    {
      ip: "192.168.10.2",
      mac: "00:24:01:AA:BB:CC",
      vendor: "MikroTik",
      hostname: "switch-acceso",
      type: "switch",
    },
  ]);

  assert.deepEqual(devices, [
    {
      candidateType: "CAMARA_PTZ",
      name: "cam-norte",
      ip: "192.168.10.101",
      mac: "AA:BB:CC:DD:EE:FF",
      vendor: "Hikvision",
      model: "DS-2DE2A404IW-DE3",
      hostname: "cam-norte",
      discoveryConfidence: 92,
      rawPayload: {
        ip: "192.168.10.101",
        mac: "AA:BB:CC:DD:EE:FF",
        vendor: "Hikvision",
        hostname: "cam-norte",
        model: "DS-2DE2A404IW-DE3",
        type: "camera_ptz",
        confidence: 92,
      },
    },
    {
      candidateType: "SWITCH",
      name: "switch-acceso",
      ip: "192.168.10.2",
      mac: "00:24:01:AA:BB:CC",
      vendor: "MikroTik",
      model: null,
      hostname: "switch-acceso",
      discoveryConfidence: 50,
      rawPayload: {
        ip: "192.168.10.2",
        mac: "00:24:01:AA:BB:CC",
        vendor: "MikroTik",
        hostname: "switch-acceso",
        type: "switch",
      },
    },
  ]);
});
