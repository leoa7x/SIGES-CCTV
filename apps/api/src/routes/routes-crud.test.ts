import assert from "node:assert/strict";
import test from "node:test";

import { FiberCablesService } from "../fiber-cables/fiber-cables.service";
import { FiberPointsService } from "../fiber-points/fiber-points.service";
import { RoutesService } from "./routes.service";
import { SplicesService } from "../splices/splices.service";

function createDeleteManyRecorder() {
  const calls: unknown[] = [];
  return {
    calls,
    fn: async (args: unknown) => {
      calls.push(args);
      return { count: 1 };
    },
  };
}

test("RoutesService.remove rejects deleting a route that still has nodes", async () => {
  const service = new RoutesService({
    route: {
      findUniqueOrThrow: async () => ({ id: "route-1", identifier: "RUTA-001", _count: { nodes: 2 } }),
    },
  } as never);

  await assert.rejects(() => service.remove("route-1"), /nodos asociados/i);
});

test("RoutesService.remove deletes fiber topology and the route when no nodes remain", async () => {
  const blockInputs = createDeleteManyRecorder();
  const connections = createDeleteManyRecorder();
  const legs = createDeleteManyRecorder();
  const cableUpdateMany = createDeleteManyRecorder();
  const cableDeleteMany = createDeleteManyRecorder();
  const pointDeleteMany = createDeleteManyRecorder();
  const spliceDeleteMany = createDeleteManyRecorder();
  let deletedRouteId = "";

  const service = new RoutesService({
    route: {
      findUniqueOrThrow: async () => ({ id: "route-1", identifier: "RUTA-001", _count: { nodes: 0 } }),
      delete: async ({ where }: { where: { id: string } }) => {
        deletedRouteId = where.id;
        return { id: where.id };
      },
    },
    spliceClosure: {
      findMany: async () => [{ id: "splice-1" }],
      deleteMany: spliceDeleteMany.fn,
    },
    fiberCable: {
      findMany: async () => [{ id: "cable-1" }],
      updateMany: cableUpdateMany.fn,
      deleteMany: cableDeleteMany.fn,
    },
    spliceBlockInput: { deleteMany: blockInputs.fn },
    spliceFiberConnection: { deleteMany: connections.fn },
    spliceCableLeg: { deleteMany: legs.fn },
    fiberPoint: { deleteMany: pointDeleteMany.fn },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  } as never);

  await service.remove("route-1");

  assert.equal(deletedRouteId, "route-1");
  assert.equal(blockInputs.calls.length, 1);
  assert.equal(connections.calls.length, 1);
  assert.equal(legs.calls.length, 1);
  assert.equal(cableUpdateMany.calls.length, 1);
  assert.equal(cableDeleteMany.calls.length, 1);
  assert.equal(pointDeleteMany.calls.length, 1);
  assert.equal(spliceDeleteMany.calls.length, 1);
});

test("FiberPointsService.remove rejects deleting a point used by a cable or linked splice", async () => {
  const service = new FiberPointsService({
    fiberPoint: {
      findUniqueOrThrow: async () => ({
        id: "point-1",
        name: "Mufla 1",
        spliceId: "splice-1",
        _count: { originCables: 1, destinationCables: 0 },
      }),
    },
  } as never);

  await assert.rejects(() => service.remove("point-1"), /cables|empalme/i);
});

test("FiberCablesService.remove rejects deleting a cable with children or splice legs", async () => {
  const service = new FiberCablesService({
    fiberCable: {
      findUniqueOrThrow: async () => ({
        id: "cable-1",
        code: "FO-001",
        _count: { childCables: 1, spliceLegs: 1 },
      }),
    },
  } as never);

  await assert.rejects(() => service.remove("cable-1"), /derivaciones|empalmes/i);
});

test("SplicesService.remove deletes its fiber point before deleting the splice", async () => {
  let deletedPointId = "";
  let deletedSpliceId = "";

  const service = new SplicesService({
    spliceClosure: {
      findUniqueOrThrow: async () => ({
        id: "splice-1",
        code: "EMP-001",
        point: { id: "point-1" },
        _count: { sourceCables: 0, cableLegs: 0, blockInputs: 0, connections: 0 },
      }),
      delete: async ({ where }: { where: { id: string } }) => {
        deletedSpliceId = where.id;
        return { id: where.id };
      },
    },
    fiberPoint: {
      delete: async ({ where }: { where: { id: string } }) => {
        deletedPointId = where.id;
        return { id: where.id };
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  } as never);

  await service.remove("splice-1");

  assert.equal(deletedPointId, "point-1");
  assert.equal(deletedSpliceId, "splice-1");
});
