import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

import { LogbookService } from "./logbook.service";

test("findAll paginates and scopes by nodeId", async () => {
  const calls: unknown[] = [];
  const prisma = {
    logbookEntry: {
      findMany: async (args: unknown) => { calls.push(args); return [{ id: "e1" }]; },
      count: async () => 5,
    },
  };
  const service = new LogbookService(prisma as never);

  const result = await service.findAll({ nodeId: "node-1", page: "2", pageSize: "10" });

  const args = calls[0] as { where: { nodeId: string }; skip: number; take: number };
  assert.equal(args.where.nodeId, "node-1");
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
  assert.deepEqual(result, { items: [{ id: "e1" }], total: 5, page: 2, pageSize: 10 });
});

test("create rejects VIEWER role", async () => {
  const service = new LogbookService({} as never);

  await assert.rejects(
    // create() throws synchronously (no `await` before the guard clause) —
    // wrap in an async arrow so assert.rejects can observe the rejection.
    async () => service.create(
      { activityType: "INSPECTION", result: "SATISFACTORY", technicianId: "t1", nodeId: "n1" } as never,
      UserRole.VIEWER,
    ),
    (error: unknown) => error instanceof ForbiddenException,
  );
});
