import assert from "node:assert/strict";
import test from "node:test";
import { EntityState, UserRole } from "@prisma/client";

import { UsersService } from "./users.service";

function buildService(
  existingRole: UserRole,
  options: { state?: EntityState; otherActiveSuperAdmins?: number } = {},
) {
  const existingState = options.state ?? EntityState.ACTIVE;
  const otherActiveSuperAdmins = options.otherActiveSuperAdmins ?? 1;
  let updateData: Record<string, unknown> | undefined;
  const prisma = {
    user: {
      findUniqueOrThrow: async () => ({ id: "user-1", role: existingRole, state: existingState }),
      count: async () => otherActiveSuperAdmins,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { id: "user-1", ...data };
      },
    },
  };
  const service = new (UsersService as any)(prisma) as UsersService;
  return { service, getUpdateData: () => updateData };
}

test("update rejects a non-super-admin trying to promote a user to SUPER_ADMIN", async () => {
  const { service } = buildService(UserRole.OPERATOR);

  await assert.rejects(
    () => service.update("user-1", { role: UserRole.SUPER_ADMIN }, UserRole.SUPERVISOR),
    /super admin/i,
  );
});

test("update rejects a non-super-admin trying to promote a user to ADMIN", async () => {
  const { service } = buildService(UserRole.OPERATOR);

  await assert.rejects(
    () => service.update("user-1", { role: UserRole.ADMIN }, UserRole.ADMIN),
    /super admin/i,
  );
});

test("update rejects a non-super-admin touching an existing elevated account's permissions", async () => {
  const { service } = buildService(UserRole.ADMIN);

  await assert.rejects(
    () => service.update("user-1", { permissions: [] }, UserRole.ADMIN),
    /super admin/i,
  );
});

test("update allows a super admin to promote a user to SUPER_ADMIN", async () => {
  const { service, getUpdateData } = buildService(UserRole.OPERATOR);

  await service.update("user-1", { role: UserRole.SUPER_ADMIN }, UserRole.SUPER_ADMIN);

  assert.equal(getUpdateData()?.role, UserRole.SUPER_ADMIN);
});

test("update allows a non-super-admin to manage a non-elevated user's permissions", async () => {
  const { service, getUpdateData } = buildService(UserRole.OPERATOR);

  await service.update("user-1", { role: UserRole.SUPERVISOR }, UserRole.ADMIN);

  assert.equal(getUpdateData()?.role, UserRole.SUPERVISOR);
});

test("update rejects a non-super-admin deactivating an elevated account without touching role/permissions", async () => {
  const { service } = buildService(UserRole.ADMIN);

  await assert.rejects(
    () => service.update("user-1", { state: EntityState.INACTIVE }, UserRole.ADMIN),
    /super admin/i,
  );
});

test("update rejects deactivating the last active super admin, even by a super admin", async () => {
  const { service } = buildService(UserRole.SUPER_ADMIN, { otherActiveSuperAdmins: 0 });

  await assert.rejects(
    () => service.update("user-1", { state: EntityState.INACTIVE }, UserRole.SUPER_ADMIN),
    /last active super admin/i,
  );
});

test("update rejects demoting the last active super admin to a lower role", async () => {
  const { service } = buildService(UserRole.SUPER_ADMIN, { otherActiveSuperAdmins: 0 });

  await assert.rejects(
    () => service.update("user-1", { role: UserRole.ADMIN }, UserRole.SUPER_ADMIN),
    /last active super admin/i,
  );
});

test("update allows deactivating a super admin when another active super admin remains", async () => {
  const { service, getUpdateData } = buildService(UserRole.SUPER_ADMIN, { otherActiveSuperAdmins: 1 });

  await service.update("user-1", { state: EntityState.INACTIVE }, UserRole.SUPER_ADMIN);

  assert.equal(getUpdateData()?.state, EntityState.INACTIVE);
});
