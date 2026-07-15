import assert from "node:assert/strict";
import test from "node:test";

import { UnauthorizedException } from "@nestjs/common";

import { AuthService } from "./auth.service";

function buildService(user: { email: string; passwordHash: string; state: string; id: string; role: string } | null) {
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
