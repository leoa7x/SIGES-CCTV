import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { Permission, UserRole } from "@prisma/client";

import { PermissionsGuard } from "./permissions.guard";

function buildContext(user: { role: UserRole; permissions: Permission[] } | null) {
  return {
    getHandler: () => "handler",
    getClass: () => "class",
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as never;
}

test("PermissionsGuard allows ADMIN and SUPER_ADMIN to bypass granular permission checks", () => {
  const reflector = {
    getAllAndOverride: () => [Permission.MANAGE_USERS],
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  assert.equal(
    guard.canActivate(buildContext({ role: UserRole.ADMIN, permissions: [] })),
    true,
  );
  assert.equal(
    guard.canActivate(buildContext({ role: UserRole.SUPER_ADMIN, permissions: [] })),
    true,
  );
});

test("PermissionsGuard allows any authenticated user when a handler overrides with an empty permission list", () => {
  const reflector = {
    getAllAndOverride: () => [],
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  assert.equal(
    guard.canActivate(buildContext({ role: UserRole.VIEWER, permissions: [] })),
    true,
  );
});

test("PermissionsGuard requires matching permissions for non-admin roles", () => {
  const reflector = {
    getAllAndOverride: () => [Permission.MANAGE_USERS],
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  assert.equal(
    guard.canActivate(buildContext({ role: UserRole.SUPERVISOR, permissions: [] })),
    false,
  );
  assert.equal(
    guard.canActivate(
      buildContext({ role: UserRole.SUPERVISOR, permissions: [Permission.MANAGE_USERS] }),
    ),
    true,
  );
});

test("PermissionsGuard accepts report permissions for non-admin roles", () => {
  const reflector = {
    getAllAndOverride: () => [Permission.REPORTS_VIEW],
  } as unknown as Reflector;
  const guard = new PermissionsGuard(reflector);

  assert.equal(
    guard.canActivate(
      buildContext({ role: UserRole.SUPERVISOR, permissions: [Permission.REPORTS_VIEW] }),
    ),
    true,
  );
});
