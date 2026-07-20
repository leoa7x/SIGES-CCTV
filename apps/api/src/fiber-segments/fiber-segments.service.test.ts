import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import { FiberSegmentsService } from "./fiber-segments.service";

function buildPrisma(poleByNode: Record<string, boolean>) {
  let created = false;
  const prisma = {
    node: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
        hasPole: poleByNode[where.id] ?? false,
      }),
    },
    fiberSegment: {
      create: async (args: unknown) => { created = true; return { id: "seg-1", ...(args as object) }; },
    },
  };
  return { prisma, wasCreated: () => created };
}

test("create rejects when nodeA is not marked as a pole", async () => {
  const { prisma, wasCreated } = buildPrisma({ "node-a": false, "node-b": true });
  const service = new FiberSegmentsService(prisma as never);

  await assert.rejects(
    async () => service.create({ nodeAId: "node-a", nodeBId: "node-b" } as never),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(wasCreated(), false);
});

test("create rejects when nodeB is not marked as a pole", async () => {
  const { prisma, wasCreated } = buildPrisma({ "node-a": true, "node-b": false });
  const service = new FiberSegmentsService(prisma as never);

  await assert.rejects(
    async () => service.create({ nodeAId: "node-a", nodeBId: "node-b" } as never),
    (error: unknown) => error instanceof BadRequestException,
  );
  assert.equal(wasCreated(), false);
});

test("create succeeds when both nodes are marked as poles", async () => {
  const { prisma, wasCreated } = buildPrisma({ "node-a": true, "node-b": true });
  const service = new FiberSegmentsService(prisma as never);

  const result = await service.create({ nodeAId: "node-a", nodeBId: "node-b", waypoints: [[1, 2]] } as never);

  assert.equal(wasCreated(), true);
  assert.equal(result.id, "seg-1");
});
