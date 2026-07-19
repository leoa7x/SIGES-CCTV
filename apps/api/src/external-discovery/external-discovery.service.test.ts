import assert from "node:assert/strict";
import test from "node:test";

import { ExternalDiscoveryService } from "./external-discovery.service";

test("upsertScanFindings stores out-of-subnet devices as pending external findings", async () => {
  let upsertArgs: Record<string, unknown> | null = null;
  const service = new ExternalDiscoveryService({
    externalDiscoveryFinding: {
      findUnique: async () => null,
      upsert: async (args: Record<string, unknown>) => {
        upsertArgs = args;
        return { id: "finding-1" };
      },
      findMany: async () => [],
      update: async () => ({ id: "finding-1" }),
    },
  } as never);

  await service.upsertScanFindings(
    "center-1",
    "172.16.45.0/24",
    "172.16.45.1",
    [
      {
        ip: "172.16.46.10",
        mac: "AA:BB:CC:00:11:22",
        vendor: "Cisco",
        hostname: "edge-host",
        model: "X",
        candidateType: "SWITCH",
        discoveryConfidence: 71,
      },
    ],
    "SCAN",
  );

  assert.ok(upsertArgs);
  const serializedArgs = upsertArgs as { where: Record<string, unknown>; create: Record<string, unknown> };

  assert.deepEqual(serializedArgs.where, {
    identityKey: "center-1|172.16.46.10|AA:BB:CC:00:11:22|edge-host",
  });

  const create = serializedArgs.create;
  assert.equal(create.centerId, "center-1");
  assert.equal(create.source, "SCAN");
  assert.equal(create.status, "PENDING");
  assert.equal(create.outsideExpectedSubnet, true);
  assert.equal(create.expectedSubnetCidr, "172.16.45.0/24");
  assert.equal(create.observedFromTargetIp, "172.16.45.1");
});

test("setStatus updates an external finding status", async () => {
  let updateArgs: unknown = null;
  const service = new ExternalDiscoveryService({
    externalDiscoveryFinding: {
      findUnique: async () => null,
      upsert: async () => ({ id: "finding-1" }),
      findMany: async () => [],
      update: async (args: unknown) => {
        updateArgs = args;
        return { id: "finding-1" };
      },
    },
  } as never);

  const result = await service.setStatus("finding-1", "CONFIRMED");

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(updateArgs, {
    where: { id: "finding-1" },
    data: { status: "CONFIRMED" },
  });
});
