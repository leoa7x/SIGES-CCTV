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
    { ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" },
    { ip: "192.168.1.20", bytesIn: 300, bytesOut: 150, flowCount: 4, lastSeenAt: "2026-07-20T17:59:58.000Z" },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(payloads[0]?.nodeId, "node-1");
  assert.deepEqual(payloads[0]?.totals, { bytesIn: 400, bytesOut: 200, activeHosts: 2, activeFlows: 6 });
});
