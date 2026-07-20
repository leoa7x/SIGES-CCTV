import assert from "node:assert/strict";
import test from "node:test";

import { IncidentsService } from "./incidents.service";

function buildPrisma(findManyArgs: unknown[]) {
  return {
    incident: {
      findMany: async (args: unknown) => { findManyArgs.push(args); return [{ id: "i1" }]; },
      count: async () => 42,
    },
  };
}

test("findAll defaults to page 1 / pageSize 25 with no filters", async () => {
  const calls: unknown[] = [];
  const service = new IncidentsService(buildPrisma(calls) as never);

  const result = await service.findAll({});

  const args = calls[0] as { where: unknown; skip: number; take: number };
  assert.deepEqual(args.where, {});
  assert.equal(args.skip, 0);
  assert.equal(args.take, 25);
  assert.deepEqual(result, { items: [{ id: "i1" }], total: 42, page: 1, pageSize: 25 });
});

test("findAll combines status filter and search into a single where clause", async () => {
  const calls: unknown[] = [];
  const service = new IncidentsService(buildPrisma(calls) as never);

  await service.findAll({ status: "NEW", search: "switch", page: "2", pageSize: "10" });

  const args = calls[0] as {
    where: { status: string; OR: Array<Record<string, unknown>> };
    skip: number;
    take: number;
  };
  assert.equal(args.where.status, "NEW");
  assert.deepEqual(args.where.OR, [
    { title: { contains: "switch", mode: "insensitive" } },
    { node: { is: { name: { contains: "switch", mode: "insensitive" } } } },
    { node: { is: { code: { contains: "switch", mode: "insensitive" } } } },
  ]);
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
});
