import assert from "node:assert/strict";
import test from "node:test";

import { expandBlockInput } from "./expand-blocks";

test("expands a straight block range into per-fiber connections", () => {
  const result = expandBlockInput({
    fromLegId: "leg-in",
    fromFiberStart: 1,
    fromFiberEnd: 4,
    toLegId: "leg-out",
    toFiberStart: 9,
    toFiberEnd: 12,
    blockKind: "FUSION",
  });

  assert.deepEqual(result, [
    { fromLegId: "leg-in", fromFiberNumber: 1, toLegId: "leg-out", toFiberNumber: 9, connectionKind: "FUSION" },
    { fromLegId: "leg-in", fromFiberNumber: 2, toLegId: "leg-out", toFiberNumber: 10, connectionKind: "FUSION" },
    { fromLegId: "leg-in", fromFiberNumber: 3, toLegId: "leg-out", toFiberNumber: 11, connectionKind: "FUSION" },
    { fromLegId: "leg-in", fromFiberNumber: 4, toLegId: "leg-out", toFiberNumber: 12, connectionKind: "FUSION" },
  ]);
});

test("rejects blocks whose ranges do not have the same length", () => {
  assert.throws(
    () =>
      expandBlockInput({
        fromLegId: "leg-in",
        fromFiberStart: 1,
        fromFiberEnd: 6,
        toLegId: "leg-out",
        toFiberStart: 1,
        toFiberEnd: 4,
        blockKind: "FUSION",
      }),
    /same length/,
  );
});

test("rejects invalid descending ranges", () => {
  assert.throws(
    () =>
      expandBlockInput({
        fromLegId: "leg-in",
        fromFiberStart: 12,
        fromFiberEnd: 1,
        toLegId: "leg-out",
        toFiberStart: 1,
        toFiberEnd: 12,
        blockKind: "RESERVE",
      }),
    /ascending/,
  );
});
