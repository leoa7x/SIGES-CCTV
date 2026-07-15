import assert from "node:assert/strict";
import test from "node:test";

import { normalizePermissionsForRole, shouldRoleUseGranularPermissions } from "./user-permissions";

test("admins keep full access and ignore granular permissions", () => {
  assert.equal(shouldRoleUseGranularPermissions("ADMIN"), false);
  assert.equal(shouldRoleUseGranularPermissions("SUPER_ADMIN"), false);
  assert.deepEqual(normalizePermissionsForRole("ADMIN", ["MANAGE_USERS", "VIEW_TELEMETRY"]), []);
});

test("non-admin roles keep deduplicated granular permissions", () => {
  assert.equal(shouldRoleUseGranularPermissions("SUPERVISOR"), true);
  assert.deepEqual(
    normalizePermissionsForRole("SUPERVISOR", ["VIEW_TELEMETRY", "MANAGE_USERS", "VIEW_TELEMETRY"]),
    ["VIEW_TELEMETRY", "MANAGE_USERS"],
  );
});
