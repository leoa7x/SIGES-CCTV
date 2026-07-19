import assert from "node:assert/strict";
import test from "node:test";

import { NodeHeartbeatScheduler } from "./node-heartbeat-scheduler.service";

test("runCycle marks a node OFFLINE and upserts NODE_UNREACHABLE after the configured failure threshold", async () => {
  const updates: unknown[] = [];
  const alerts: unknown[] = [];
  const prisma = {
    node: {
      findMany: async () => [{
        id: "node-1",
        code: "N1",
        name: "Nodo 1",
        primaryIp: "192.168.1.6",
        operativeState: "ONLINE",
        heartbeatFailureCount: 1,
        assets: [],
        route: { monitoringCenterId: "center-1" },
      }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
    nodeAsset: { update: async () => ({}) },
  };
  const probe = { probeIp: async () => ({ reachable: false, checkedAt: new Date(), detail: "timeout" }) };
  const operationalAlerts = {
    ensureAlert: async (args: unknown) => { alerts.push(args); },
    resolveAlerts: async () => undefined,
  };

  const scheduler = new NodeHeartbeatScheduler(prisma as never, probe as never, operationalAlerts as never);
  await scheduler.runCycle();

  assert.equal(updates.length, 1);
  assert.equal((updates[0] as { data: { operativeState: string } }).data.operativeState, "OFFLINE");
  assert.equal((alerts[0] as { kind: string }).kind, "NODE_UNREACHABLE");
});
