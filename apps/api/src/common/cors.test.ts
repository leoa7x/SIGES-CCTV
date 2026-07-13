import assert from "node:assert/strict";
import test from "node:test";

import { getAllowedCorsOrigins, isAllowedCorsOrigin } from "./cors";

test("allows localhost and 127.0.0.1 aliases for the configured dev origin", () => {
  const allowed = getAllowedCorsOrigins("http://localhost:3001");

  assert.deepEqual(allowed.sort(), ["http://127.0.0.1:3001", "http://localhost:3001"]);
  assert.equal(isAllowedCorsOrigin("http://localhost:3001", "http://localhost:3001"), true);
  assert.equal(isAllowedCorsOrigin("http://127.0.0.1:3001", "http://localhost:3001"), true);
});

test("supports comma-separated origins and keeps non-localhost hosts exact", () => {
  const allowed = getAllowedCorsOrigins("http://localhost:3001,https://ops.example.com");

  assert.deepEqual(allowed.sort(), [
    "http://127.0.0.1:3001",
    "http://localhost:3001",
    "https://ops.example.com",
  ]);
  assert.equal(isAllowedCorsOrigin("https://ops.example.com", "http://localhost:3001,https://ops.example.com"), true);
  assert.equal(isAllowedCorsOrigin("https://evil.example.com", "http://localhost:3001,https://ops.example.com"), false);
});

test("allows requests without an Origin header", () => {
  assert.equal(isAllowedCorsOrigin(undefined, "http://localhost:3001"), true);
});
