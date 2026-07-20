import assert from "node:assert/strict";
import test from "node:test";

import { parsePagination } from "./pagination";

test("parsePagination defaults to page 1, pageSize 25 when unset", () => {
  assert.deepEqual(parsePagination(undefined, undefined), { page: 1, pageSize: 25, skip: 0, take: 25 });
});

test("parsePagination computes skip from page and pageSize", () => {
  assert.deepEqual(parsePagination("3", "10"), { page: 3, pageSize: 10, skip: 20, take: 10 });
});

test("parsePagination clamps pageSize to the 100-row ceiling", () => {
  assert.deepEqual(parsePagination("1", "500"), { page: 1, pageSize: 100, skip: 0, take: 100 });
});

test("parsePagination falls back to defaults for invalid/negative input", () => {
  assert.deepEqual(parsePagination("-5", "0"), { page: 1, pageSize: 25, skip: 0, take: 25 });
  assert.deepEqual(parsePagination("abc", "xyz"), { page: 1, pageSize: 25, skip: 0, take: 25 });
});
