import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CameraPreviewController } from "./camera-preview.controller";
import { CameraPreviewService } from "./camera-preview.service";

const connection = {
  streamUrl: "rtsp://camera.example/live",
  streamUsername: "operator",
  streamPassword: "secret",
  streamTransport: "TCP" as const,
};

function createService(options?: { start?: () => Promise<void> }) {
  const adapter = {
    start: options?.start ?? (async () => undefined),
    stop: async () => undefined,
    getStream: () => null,
  };
  const cameras = {
    getPreviewConnection: async () => connection,
  };

  return new CameraPreviewService(cameras as never, adapter as never);
}

test("startPreview binds a session to the requesting user and returns a viewer URL", async () => {
  const service = createService();

  const result = await service.startPreview("camera-1", "user-1");

  assert.equal(result.status, "starting");
  assert.match(result.viewerUrl, /^\/cameras\/preview\/[^/]+\/media$/);
  assert.ok(Date.parse(result.expiresAt) > Date.now());
});

test("preview status rejects a session owned by another user", async () => {
  const service = createService();
  const preview = await service.startPreview("camera-1", "user-1");

  assert.throws(() => service.getPreviewStatus(preview.sessionId, "user-2"), ForbiddenException);
});

test("preview sessions stop and remove themselves when their expiry timer fires", async () => {
  let stops = 0;
  let expire: (() => void) | undefined;
  const originalSetTimeout = global.setTimeout;
  (global as typeof globalThis).setTimeout = ((callback: () => void) => {
    expire = callback;
    return { unref() {} } as never;
  }) as unknown as typeof setTimeout;
  const adapter = { start: async () => undefined, stop: async () => { stops += 1; }, getStream: () => null };
  const cameras = { getPreviewConnection: async () => connection };
  try {
    const service = new CameraPreviewService(cameras as never, adapter as never);
    const preview = await service.startPreview("camera-1", "user-1");

    expire?.();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(stops, 1);
    assert.throws(() => service.getPreviewStatus(preview.sessionId, "user-1"), NotFoundException);
  } finally {
    (global as typeof globalThis).setTimeout = originalSetTimeout;
  }
});

test("stopping a preview kills its process and removes the session", async () => {
  let stops = 0;
  const adapter = { start: async () => undefined, stop: async () => { stops += 1; }, getStream: () => null };
  const cameras = { getPreviewConnection: async () => connection };
  const service = new CameraPreviewService(cameras as never, adapter as never);
  const preview = await service.startPreview("camera-1", "user-1");

  await service.stopPreview(preview.sessionId, "user-1");

  assert.equal(stops, 1);
  assert.throws(() => service.getPreviewStatus(preview.sessionId, "user-1"), NotFoundException);
});

test("closing the media response stops the requesting user's preview", async () => {
  let stopped: [string, string] | undefined;
  const stream = { pipe: () => undefined };
  const preview = {
    getMediaStream: () => stream,
    stopPreview: async (sessionId: string, userId: string) => { stopped = [sessionId, userId]; },
  };
  const controller = new CameraPreviewController(preview as never);
  const response = new EventEmitter() as EventEmitter & { setHeader: (name: string, value: string) => void };
  response.setHeader = () => undefined;

  controller.media("session-1", { user: { id: "user-1" } } as never, response as never);
  response.emit("close");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(stopped, ["session-1", "user-1"]);
});

test("adapter startup failures produce a redacted failed session", async () => {
  const service = createService({ start: async () => { throw new Error("rtsp://operator:secret@camera.example failed"); } });

  const preview = await service.startPreview("camera-1", "user-1");

  assert.deepEqual(service.getPreviewStatus(preview.sessionId, "user-1"), {
    status: "failed",
    errorCode: "PREVIEW_START_FAILED",
    message: "Unable to start live preview",
  });
});

test("a preview without a media stream becomes a redacted failed session", async () => {
  const service = createService();
  const preview = await service.startPreview("camera-1", "user-1");

  assert.deepEqual(service.getPreviewStatus(preview.sessionId, "user-1"), {
    status: "failed",
    errorCode: "PREVIEW_STREAM_UNAVAILABLE",
    message: "Live preview stream is unavailable",
  });
});
