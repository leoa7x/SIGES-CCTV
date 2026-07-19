import assert from "node:assert/strict";
import test from "node:test";

import { mapWithConcurrency } from "./heartbeat-concurrency";

test("mapWithConcurrency never runs more than `limit` workers at once", async () => {
  const items = Array.from({ length: 20 }, (_, index) => index);
  let inFlight = 0;
  let maxInFlight = 0;

  const results = await mapWithConcurrency(items, 4, async (item) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return item * 2;
  });

  assert.ok(maxInFlight <= 4, `expected at most 4 concurrent workers, saw ${maxInFlight}`);
  assert.deepEqual(results, items.map((item) => item * 2));
});

test("mapWithConcurrency preserves result order regardless of completion order", async () => {
  const delays = [30, 10, 20, 5];
  const results = await mapWithConcurrency(delays, 4, async (delay, index) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return index;
  });

  assert.deepEqual(results, [0, 1, 2, 3]);
});

test("mapWithConcurrency lets one item's rejection surface without corrupting others", async () => {
  const items = [1, 2, 3];
  await assert.rejects(() =>
    mapWithConcurrency(items, 2, async (item) => {
      if (item === 2) throw new Error("boom");
      return item;
    }),
  );
});
