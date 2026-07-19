import assert from "node:assert/strict";
import test from "node:test";

import { CenterHeartbeatScheduler } from "./center-heartbeat-scheduler.service";

test("runCycle marks a center OFFLINE and upserts CENTER_UNREACHABLE after the configured failure threshold", async () => {
  const updates: unknown[] = [];
  const alerts: unknown[] = [];
  const prisma = {
    monitoringCenter: {
      findMany: async () => [{
        id: "center-1",
        name: "CMC 1",
        primaryIp: "192.168.1.1",
        operativeState: "ONLINE",
        heartbeatFailureCount: 1,
        centerAssets: [],
      }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
    centerAsset: { update: async () => ({}) },
  };
  const probe = { probeIp: async () => ({ reachable: false, checkedAt: new Date(), detail: "timeout" }) };
  const operationalAlerts = {
    ensureAlert: async (args: unknown) => { alerts.push(args); },
    resolveAlerts: async () => undefined,
  };

  const scheduler = new CenterHeartbeatScheduler(prisma as never, probe as never, operationalAlerts as never);
  await scheduler.runCycle();

  assert.equal(updates.length, 1);
  assert.equal((updates[0] as { data: { operativeState: string } }).data.operativeState, "OFFLINE");
  assert.equal((alerts[0] as { kind: string }).kind, "CENTER_UNREACHABLE");
});
