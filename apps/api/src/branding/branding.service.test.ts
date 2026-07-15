import assert from "node:assert/strict";
import test from "node:test";

import { BrandingService } from "./branding.service";

test("create activates one branding profile and deactivates the previous active profile", async () => {
  const updateManyCalls: unknown[] = [];
  const createdPayloads: unknown[] = [];
  const brandingProfile = {
    updateMany: async (args: unknown) => {
      updateManyCalls.push(args);
      return { count: 1 };
    },
    create: async (args: { data: Record<string, unknown> }) => {
      createdPayloads.push(args.data);
      return { id: "brand-1", ...args.data };
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: { brandingProfile: typeof brandingProfile }) => Promise<unknown>) =>
      callback({ brandingProfile }),
    brandingProfile,
    city: { findUnique: async () => ({ id: "city-1" }) },
  };

  const service = new BrandingService(prisma as never, {} as never);
  const result = await service.create({
    name: "Gobernacion Meta",
    cityId: "city-1",
    loginMessage: "Centro de monitoreo departamental",
    isActive: true,
  });

  assert.equal((result as { id: string }).id, "brand-1");
  assert.equal(updateManyCalls.length, 1);
  assert.deepEqual(createdPayloads[0], {
    name: "Gobernacion Meta",
    cityId: "city-1",
    loginMessage: "Centro de monitoreo departamental",
    isActive: true,
  });
});

test("getActivePublic returns null when there is no active profile", async () => {
  const prisma = {
    brandingProfile: {
      findFirst: async () => null,
    },
    city: { findUnique: async () => null },
  };

  const service = new BrandingService(prisma as never, {} as never);
  const result = await service.getActivePublic();

  assert.equal(result, null);
});
