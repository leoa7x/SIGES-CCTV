import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException } from "@nestjs/common";

import { NodesService } from "./nodes.service";

function buildService(telemetrySnapshotCount: number) {
  let transactionCalled = false;
  let nodeDeleteCalled = false;

  const prisma = {
    node: {
      findUniqueOrThrow: async () => ({
        id: "node-1",
        cameras: [],
        assets: [],
        discoveryJobs: [],
        fiberPoints: [],
      }),
      delete: () => {
        nodeDeleteCalled = true;
        return Promise.resolve({ id: "node-1" });
      },
    },
    networkTelemetrySnapshot: {
      count: async () => telemetrySnapshotCount,
    },
    incident: { deleteMany: () => ({}) },
    logbookEntry: { deleteMany: () => ({}) },
    nodeAnalyticsAssignment: { deleteMany: () => ({}) },
    nodeAssetAnalyticsAssignment: { deleteMany: () => ({}) },
    nodeDiscoveredDevice: { deleteMany: () => ({}) },
    nodeDiscoveryJob: { deleteMany: () => ({}) },
    camera: { deleteMany: () => ({}) },
    nodeAsset: { deleteMany: () => ({}) },
    fiberSegment: { deleteMany: () => ({}) },
    fiberPoint: { deleteMany: () => ({}) },
    fiberCable: { findMany: async () => [], updateMany: () => ({}), deleteMany: () => ({}) },
    spliceCableLeg: { findMany: async () => [], deleteMany: () => ({}) },
    spliceBlockInput: { deleteMany: () => ({}) },
    spliceFiberConnection: { deleteMany: () => ({}) },
    $transaction: async () => {
      transactionCalled = true;
      return [];
    },
  };

  return {
    service: new NodesService(prisma as any),
    transactionCalled: () => transactionCalled,
    nodeDeleteCalled: () => nodeDeleteCalled,
  };
}

test("remove rejects deleting a node with telemetry snapshots and explains the dependency", async () => {
  const { service, transactionCalled, nodeDeleteCalled } = buildService(3);

  await assert.rejects(
    () => service.remove("node-1"),
    (error: unknown) => error instanceof ConflictException
      && error.message === "No se puede eliminar el nodo porque todavía tiene historial de telemetría asociado. Debes borrar primero esos registros.",
  );

  assert.equal(transactionCalled(), false);
  assert.equal(nodeDeleteCalled(), false);
});
