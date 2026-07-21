import assert from "node:assert/strict";
import test from "node:test";

import { NtopngCollectorService } from "./ntopng-collector.service";

test("buildSnapshots aggregates multiple correlated hosts into one node payload", async () => {
  const service = new NtopngCollectorService({
    correlateHost: async (host) => host.ip === "192.168.1.6"
      ? { kind: "node", nodeId: "node-1" }
      : { kind: "node", nodeId: "node-1" },
  });

  const payloads = await service.buildSnapshots("2026-07-20T18:00:00.000Z", [
    {
      ip: "192.168.1.6",
      bytesIn: 100,
      bytesOut: 50,
      flowCount: 2,
      lastSeenAt: "2026-07-20T17:59:59.000Z",
      protocols: [
        { name: "TLS", bytes: 100, flowCount: 1 },
        { name: "QUIC", bytes: 50, flowCount: 1 },
      ],
    },
    {
      ip: "192.168.1.20",
      bytesIn: 300,
      bytesOut: 150,
      flowCount: 4,
      lastSeenAt: "2026-07-20T17:59:58.000Z",
      protocols: [
        { name: "TLS", bytes: 150, flowCount: 2 },
        { name: "QUIC", bytes: 75, flowCount: 1 },
      ],
    },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]?.nodeId, "node-1");
  assert.deepEqual(payloads[0]?.totals, { bytesIn: 400, bytesOut: 200, activeHosts: 2, activeFlows: 6 });
  assert.deepEqual(payloads[0]?.protocols, [
    { name: "TLS", bytes: 250, flowCount: 3 },
    { name: "QUIC", bytes: 125, flowCount: 2 },
  ]);
});

test("buildSnapshots excludes unmatched hosts from official totals and forwards them to external discovery", async () => {
  const forwarded: unknown[] = [];
  const service = new NtopngCollectorService({
    correlateHost: async (host) => host.ip === "10.0.0.9"
      ? { kind: "unmatched", reason: "NO_MATCH", centerId: "center-1" }
      : { kind: "node", nodeId: "node-1" },
    externalDiscovery: {
      upsertScanFindings: async (...args: unknown[]) => {
        forwarded.push(args);
      },
    },
  });

  const payloads = await service.buildSnapshots("2026-07-20T18:00:00.000Z", [
    { ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" },
    { ip: "10.0.0.9", bytesIn: 900, bytesOut: 400, flowCount: 3, lastSeenAt: "2026-07-20T17:59:58.000Z" },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]?.totals.bytesIn, 100);
  assert.equal(payloads[0]?.totals.bytesOut, 50);
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0], [
    "center-1",
    null,
    null,
    [{ ip: "10.0.0.9", mac: undefined, hostname: undefined }],
    "NTOPNG",
  ]);
});
