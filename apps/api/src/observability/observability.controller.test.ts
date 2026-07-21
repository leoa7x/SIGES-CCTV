import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, ParseUUIDPipe } from "@nestjs/common";

// GET /observability/embed/node/:id ends up interpolated into raw SQL inside
// the Grafana dashboard (`node_id = ${nodeId:sqlstring}`). ParseUUIDPipe is
// the first line of defense: it rejects anything that isn't a well-formed
// UUID before the value ever reaches the ObservabilityService, so a crafted
// `id` (e.g. containing a quote) can't even get that far.
const metadata = { type: "param" as const, data: "id" };

test("rejects a non-UUID node id used to probe for SQL injection", async () => {
  const pipe = new ParseUUIDPipe();

  await assert.rejects(
    async () => pipe.transform("'; DROP TABLE \"User\"; --", metadata),
    (error: unknown) => error instanceof BadRequestException,
  );
});

test("accepts a well-formed UUID", async () => {
  const pipe = new ParseUUIDPipe();

  const result = await pipe.transform("3fa85f64-5717-4562-b3fc-2c963f66afa6", metadata);

  assert.equal(result, "3fa85f64-5717-4562-b3fc-2c963f66afa6");
});
