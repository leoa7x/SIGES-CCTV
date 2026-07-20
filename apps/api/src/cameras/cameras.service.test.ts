import assert from "node:assert/strict";
import test from "node:test";

import { CameraSecretService } from "./camera-secret.service";
import { CamerasService } from "./cameras.service";

test("findAll paginates and redacts stream credentials on every item", async () => {
  const calls: unknown[] = [];
  const prisma = {
    camera: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return [{
          id: "cam-1",
          code: "CAM-001",
          streamUrl: "rtsp://admin:secret@192.168.1.20:554/stream1",
          streamPasswordEncrypted: "cipher-text",
          node: { id: "node-1" },
        }];
      },
      count: async () => 30,
    },
  };
  const secretService = { encrypt: (value: string) => value, decrypt: () => "super-secret" };
  const service = new (CamerasService as any)(prisma, secretService) as CamerasService;

  const result = await service.findAll({ search: "cam", page: "2", pageSize: "10" });

  const args = calls[0] as { where: { OR: unknown[] }; skip: number; take: number };
  assert.deepEqual(args.where.OR, [
    { code: { contains: "cam", mode: "insensitive" } },
    { name: { contains: "cam", mode: "insensitive" } },
  ]);
  assert.equal(args.skip, 10);
  assert.equal(args.take, 10);
  assert.equal(result.total, 30);
  assert.equal(result.page, 2);
  assert.equal((result.items[0] as { streamUrl?: string }).streamUrl, "rtsp://192.168.1.20:554/stream1");
  assert.equal((result.items[0] as { streamPasswordEncrypted?: string }).streamPasswordEncrypted, undefined);
});

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

test("findOne redacts legacy embedded stream credentials", async () => {
  const prisma = {
    camera: {
      findUniqueOrThrow: async () => ({
        id: "cam-1",
        streamUrl: "rtsp://operator:super-secret@192.168.1.20:554/stream1",
        streamPasswordEncrypted: null,
        node: { id: "node-1" },
      }),
    },
  };
  const service = new (CamerasService as any)(prisma, new CameraSecretService()) as CamerasService;

  const result = await service.findOne("cam-1");

  assert.equal((result as { streamUrl?: string }).streamUrl, "rtsp://192.168.1.20:554/stream1");
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

test("create strips embedded RTSP credentials and encrypts the password separately", async () => {
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
    ip: "192.168.1.20",
    streamUrl: "rtsp://operator:super-secret@192.168.1.20:554/stream1",
  } as never);

  assert.equal(createData?.streamUrl, "rtsp://192.168.1.20:554/stream1");
  assert.equal(createData?.streamUsername, "operator");
  assert.equal(secretService.decrypt(createData?.streamPasswordEncrypted as string), "super-secret");
});

test("create rejects non-RTSP preview URLs and targets that do not match the camera IP", async () => {
  const prisma = { camera: { create: async () => ({ id: "cam-1" }) } };
  const service = new (CamerasService as any)(prisma, new CameraSecretService()) as CamerasService;

  await assert.rejects(
    () => service.create({ code: "CAM-001", name: "Camara Norte", nodeId: "node-1", streamUrl: "http://192.168.1.20/live" } as never),
    /RTSP/,
  );
  await assert.rejects(
    () => service.create({ code: "CAM-001", name: "Camara Norte", nodeId: "node-1", ip: "192.168.1.20", streamUrl: "rtsp://192.168.1.21/live" } as never),
    /camera IP/,
  );
});
