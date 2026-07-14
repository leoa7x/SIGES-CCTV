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

test("normalizeDiscoveredDevices infers candidate type from model, vendor and hostname heuristics", () => {
  const devices = normalizeDiscoveredDevices([
    {
      ip: "192.168.20.10",
      mac: "10:20:30:40:50:60",
      vendor: "Hikvision",
      hostname: "equipo-borde",
      model: "DS-2DE4425IW-DE",
    },
    {
      ip: "192.168.20.2",
      mac: "00:11:22:33:44:55",
      vendor: "Cisco",
      hostname: "switch-core-zona-1",
    },
    {
      ip: "192.168.20.30",
      mac: "AA:AA:AA:AA:AA:AA",
      hostname: "ups-nodo-sur",
    },
  ]);

  assert.equal(devices[0]?.candidateType, "CAMARA_PTZ");
  assert.equal(devices[0]?.discoveryConfidence, 85);

  assert.equal(devices[1]?.candidateType, "SWITCH");
  assert.equal(devices[1]?.discoveryConfidence, 80);

  assert.equal(devices[2]?.candidateType, "UPS");
  assert.equal(devices[2]?.discoveryConfidence, 60);
});
