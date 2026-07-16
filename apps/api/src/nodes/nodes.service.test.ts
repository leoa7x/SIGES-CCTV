import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException } from "@nestjs/common";

import { NodesService } from "./nodes.service";

function buildService(
  telemetrySnapshotCount: number,
  telemetryAssetSampleCount = 0,
  telemetryAlertCount = 0,
) {
  let transactionCalled = false;
  let nodeDeleteCalled = false;
  let snapshotDeleteCalled = false;
  let assetSampleDeleteCalled = false;
  let alertDeleteCalled = false;

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
    networkTelemetryAssetSample: {
      count: async () => telemetryAssetSampleCount,
      deleteMany: ({ where }: { where: { nodeId: string } }) => {
        assetSampleDeleteCalled = where.nodeId === "node-1";
        return {};
      },
    },
    networkTelemetryAlert: {
      count: async () => telemetryAlertCount,
      deleteMany: ({ where }: { where: { nodeId: string } }) => {
        alertDeleteCalled = where.nodeId === "node-1";
        return {};
      },
    },
    networkTelemetrySnapshot: {
      count: async () => telemetrySnapshotCount,
      deleteMany: ({ where }: { where: { nodeId: string } }) => {
        snapshotDeleteCalled = where.nodeId === "node-1";
        return {};
      },
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
    snapshotDeleteCalled: () => snapshotDeleteCalled,
    assetSampleDeleteCalled: () => assetSampleDeleteCalled,
    alertDeleteCalled: () => alertDeleteCalled,
  };
}

test("remove rejects deleting a node with telemetry dependencies and explains the remaining counts", async () => {
  const { service, transactionCalled, nodeDeleteCalled } = buildService(3, 5, 2);

  await assert.rejects(
    () => service.remove("node-1"),
    (error: unknown) => error instanceof ConflictException
      && error.message === "No se puede eliminar el nodo porque todavía tiene historial de telemetría asociado. Registros pendientes: 3 snapshots, 5 muestras de activos y 2 alertas. Debes borrar primero esos registros.",
  );

  assert.equal(transactionCalled(), false);
  assert.equal(nodeDeleteCalled(), false);
});

test("clearTelemetryHistory removes alerts, asset samples, and snapshots for the node", async () => {
  const {
    service,
    transactionCalled,
    snapshotDeleteCalled,
    assetSampleDeleteCalled,
    alertDeleteCalled,
  } = buildService(3, 5, 2);

  const result = await service.clearTelemetryHistory("node-1");

  assert.deepEqual(result, {
    ok: true,
    removed: {
      snapshots: 3,
      assetSamples: 5,
      alerts: 2,
    },
  });
  assert.equal(transactionCalled(), true);
  assert.equal(alertDeleteCalled(), true);
  assert.equal(assetSampleDeleteCalled(), true);
  assert.equal(snapshotDeleteCalled(), true);
});
