import assert from "node:assert/strict";
import test from "node:test";

import { HeartbeatProbeService } from "./heartbeat-probe.service";

test("probeIp reports reachable false when the command result is unsuccessful", async () => {
  const service = new HeartbeatProbeService(async () => ({ code: 1, stdout: "", stderr: "timeout" }));
  const result = await service.probeIp("192.168.1.6");
  assert.equal(result.reachable, false);
  assert.equal(result.detail, "timeout");
});

test("probeIp reports reachable true when the command result is successful", async () => {
  const service = new HeartbeatProbeService(async () => ({ code: 0, stdout: "ok", stderr: "" }));
  const result = await service.probeIp("192.168.1.6");
  assert.equal(result.reachable, true);
  assert.equal(result.detail, null);
});
