import assert from "node:assert/strict";
import test from "node:test";

import { runCollectorCycle } from "./run_ntopng_telemetry_collector";

test("runCollectorCycle fetches hosts, builds payloads, and posts them to ingest", async () => {
  const posted: unknown[] = [];

  await runCollectorCycle({
    fetchHosts: async () => [{ ip: "192.168.1.6", bytesIn: 100, bytesOut: 50, flowCount: 2, lastSeenAt: "2026-07-20T17:59:59.000Z" }],
    buildSnapshots: async () => [{
      nodeId: "node-1",
      collectorId: "ntopng-local",
      capturedAt: "2026-07-20T18:00:00.000Z",
      windowSeconds: 60,
      totals: { bytesIn: 100, bytesOut: 50, activeHosts: 1, activeFlows: 2 },
      protocols: [],
      destinations: [],
      assets: [],
    }],
    postSnapshot: async (payload) => {
      posted.push(payload);
    },
  });

  assert.equal(posted.length, 1);
});
