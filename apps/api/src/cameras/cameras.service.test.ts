import assert from "node:assert/strict";
import test from "node:test";

import { CameraSecretService } from "./camera-secret.service";
import { CamerasService } from "./cameras.service";

test("findOne omits encrypted stream password but returns preview metadata", async () => {
  const prisma = {
    camera: {
      findUniqueOrThrow: async () => ({
        id: "cam-1",
        code: "CAM-001",
        name: "Camara Norte",
        ip: "192.168.1.20",
        streamUrl: "rtsp://192.168.1.20:554/stream1",
        streamUsername: "admin",
        streamPasswordEncrypted: "cipher-text",
        streamTransport: "TCP",
        previewEnabled: true,
        onvifUrl: "http://192.168.1.20/onvif/device_service",
        lastPreviewStatus: "LIVE",
        node: { id: "node-1", code: "N-001", name: "Nodo Norte", route: { center: { name: "CMC Norte" } } },
      }),
    },
  };

  const secretService = { encrypt: (value: string) => value, decrypt: () => "super-secret" };
  const service = new (CamerasService as any)(prisma, secretService) as CamerasService;

  const result = await service.findOne("cam-1");

  assert.equal((result as { streamPassword?: string }).streamPassword, undefined);
  assert.equal((result as { streamPasswordEncrypted?: string }).streamPasswordEncrypted, undefined);
  assert.equal((result as { streamUrl?: string }).streamUrl, "rtsp://192.168.1.20:554/stream1");
  assert.equal((result as { previewEnabled?: boolean }).previewEnabled, true);
  assert.equal((result as { streamTransport?: string }).streamTransport, "TCP");
});

test("create encrypts stream passwords before persistence", async () => {
  let createData: Record<string, unknown> | undefined;
  const prisma = {
    camera: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        return { id: "cam-1", ...data };
      },
    },
  };
  const secretService = new CameraSecretService();
  const service = new (CamerasService as any)(prisma, secretService) as CamerasService;

  await service.create({
    code: "CAM-001",
    name: "Camara Norte",
    nodeId: "node-1",
    streamPassword: "super-secret",
  } as never);

  assert.equal(createData?.streamPassword, undefined);
  assert.notEqual(createData?.streamPasswordEncrypted, "super-secret");
  assert.equal(secretService.decrypt(createData?.streamPasswordEncrypted as string), "super-secret");
});
