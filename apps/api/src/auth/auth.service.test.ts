import assert from "node:assert/strict";
import test from "node:test";

import { UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";

function buildService(user: { email: string; passwordHash: string; state: string; id: string; role: string; permissions?: string[] } | null) {
  const prisma = {
    user: {
      findUnique: async () => user,
    },
  };
  const jwtService = {
    sign: () => "token",
  };
  return new AuthService(prisma as any, jwtService as any);
}

test("login returns a localized unauthorized message when the user does not exist", async () => {
  const service = buildService(null);

  await assert.rejects(
    () => service.login("missing@entidad.gov.co", "secret"),
    (error: unknown) => error instanceof UnauthorizedException && error.message === "Credenciales inválidas",
  );
});

test("login includes granular permissions so the frontend can gate nav without knowing the user's role", async () => {
  const bcrypt = await import("bcrypt");
  const passwordHash = await bcrypt.hash("secret", 1);
  const service = buildService({
    id: "user-1",
    email: "supervisor@entidad.gov.co",
    passwordHash,
    state: "ACTIVE",
    role: "SUPERVISOR",
    permissions: ["MANAGE_CAMERAS"],
  });

  const result = await service.login("supervisor@entidad.gov.co", "secret");

  assert.deepEqual(result.user.permissions, ["MANAGE_CAMERAS"]);
});
