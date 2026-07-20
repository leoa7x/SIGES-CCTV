import assert from "node:assert/strict";
import test from "node:test";

import { correlateObservedHost } from "./network-telemetry-correlation";

test("correlateObservedHost prefers MAC matches over IP matches and marks conflicts as ambiguous", async () => {
  const result = await correlateObservedHost(
    {
      ip: "192.168.1.6",
      mac: "AA:BB:CC:DD:EE:FF",
      hostname: "celular",
      bytesIn: 10,
      bytesOut: 20,
      flowCount: 1,
      lastSeenAt: "2026-07-20T18:00:00.000Z",
    },
    {
      findNodeAssetByMac: async () => ({ id: "asset-1", nodeId: "node-1" }),
      findCenterAssetByMac: async () => null,
      findNodeAssetByIp: async () => ({ id: "asset-2", nodeId: "node-2" }),
      findCenterAssetByIp: async () => null,
      findNodeByPrimaryIp: async () => null,
      findCenterByPrimaryIp: async () => null,
    },
  );

  assert.deepEqual(result, { kind: "node", nodeId: "node-1" });
});

test("correlateObservedHost returns center ownership when no node asset matches", async () => {
  const result = await correlateObservedHost(
    { ip: "172.16.0.5" },
    {
      findNodeAssetByMac: async () => null,
      findCenterAssetByMac: async () => null,
      findNodeAssetByIp: async () => null,
      findCenterAssetByIp: async () => ({ id: "center-asset-1", centerId: "center-1" }),
      findNodeByPrimaryIp: async () => null,
      findCenterByPrimaryIp: async () => ({ id: "center-2" }),
    },
  );

  assert.deepEqual(result, { kind: "center", centerId: "center-1" });
});

test("correlateObservedHost marks same-identifier node and center matches as ambiguous", async () => {
  const result = await correlateObservedHost(
    { ip: "10.0.0.8" },
    {
      findNodeAssetByMac: async () => null,
      findCenterAssetByMac: async () => null,
      findNodeAssetByIp: async () => ({ id: "node-asset-1", nodeId: "node-1" }),
      findCenterAssetByIp: async () => ({ id: "center-asset-1", centerId: "center-1" }),
      findNodeByPrimaryIp: async () => null,
      findCenterByPrimaryIp: async () => null,
    },
  );

  assert.deepEqual(result, { kind: "unmatched", reason: "AMBIGUOUS_MATCH_ASSET" });
});

test("correlateObservedHost returns an explicit reason when no owner matches", async () => {
  const result = await correlateObservedHost(
    { hostname: "unknown" },
    {
      findNodeAssetByMac: async () => null,
      findCenterAssetByMac: async () => null,
      findNodeAssetByIp: async () => null,
      findCenterAssetByIp: async () => null,
      findNodeByPrimaryIp: async () => null,
      findCenterByPrimaryIp: async () => null,
    },
  );

  assert.deepEqual(result, { kind: "unmatched", reason: "NO_MATCH" });
});
