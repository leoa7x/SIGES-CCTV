import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { CameraPreviewService } from "./camera-preview.service";

const connection = {
  streamUrl: "rtsp://camera.example/live",
  streamUsername: "operator",
  streamPassword: "secret",
  streamTransport: "TCP" as const,
};

function createService(options?: { start?: () => Promise<void>; now?: () => number }) {
  const adapter = {
    start: options?.start ?? (async () => undefined),
    stop: async () => undefined,
    getStream: () => null,
  };
  const cameras = {
    getPreviewConnection: async () => connection,
  };

  return new CameraPreviewService(cameras as never, adapter as never, options?.now);
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

test("preview sessions expire aggressively and stop their adapter", async () => {
  let now = 1_000;
  let stops = 0;
  const adapter = { start: async () => undefined, stop: async () => { stops += 1; }, getStream: () => null };
  const cameras = { getPreviewConnection: async () => connection };
  const service = new CameraPreviewService(cameras as never, adapter as never, () => now);
  const preview = await service.startPreview("camera-1", "user-1");

  now += 60_001;
  assert.deepEqual(service.getPreviewStatus(preview.sessionId, "user-1"), { status: "expired" });
  assert.equal(stops, 1);
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
