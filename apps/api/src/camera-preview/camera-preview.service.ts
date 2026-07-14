import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CamerasService } from "../cameras/cameras.service";
import type { CameraPreviewAdapter } from "./camera-preview.adapter";
import type { PreviewSession, PreviewStartResponse, PreviewStatusResponse } from "./camera-preview.types";

const PREVIEW_TTL_MS = 60_000;

@Injectable()
export class CameraPreviewService {
  private readonly sessions = new Map<string, PreviewSession>();
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly cameras: CamerasService,
    @Inject("CameraPreviewAdapter")
    private readonly adapter: CameraPreviewAdapter,
  ) {}

  async startPreview(cameraId: string, userId: string): Promise<PreviewStartResponse> {
    const session: PreviewSession = {
      sessionId: randomUUID(),
      cameraId,
      userId,
      status: "starting",
      expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
    };
    this.sessions.set(session.sessionId, session);
    this.scheduleExpiry(session);

    try {
      await this.adapter.start(session, await this.cameras.getPreviewConnection(cameraId));
    } catch {
      session.status = "failed";
      session.errorCode = "PREVIEW_START_FAILED";
      session.message = "Unable to start live preview";
    }

    return {
      sessionId: session.sessionId,
      status: "starting",
      viewerUrl: `/cameras/preview/${session.sessionId}/media`,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  getPreviewStatus(sessionId: string, userId: string): PreviewStatusResponse {
    const session = this.getOwnedSession(sessionId, userId);
    if (session.status === "starting" || session.status === "live") {
      if (!this.adapter.getStream(sessionId)) this.markStreamUnavailable(session);
    }
    return this.toStatusResponse(session);
  }

  async stopPreview(sessionId: string, userId: string): Promise<void> {
    const session = this.getOwnedSession(sessionId, userId);
    await this.stop(session);
  }

  getMediaStream(sessionId: string, userId: string): NodeJS.ReadableStream {
    const session = this.getOwnedSession(sessionId, userId);
    if (session.status === "failed") throw new NotFoundException("Preview session is unavailable");

    const stream = this.adapter.getStream(sessionId);
    if (!stream) {
      this.markStreamUnavailable(session);
      throw new NotFoundException("Preview stream is unavailable");
    }
    session.status = "live";
    return stream;
  }

  private getOwnedSession(sessionId: string, userId: string): PreviewSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new NotFoundException("Preview session not found");
    if (session.userId !== userId) throw new ForbiddenException("Preview session belongs to another user");
    return session;
  }

  private scheduleExpiry(session: PreviewSession): void {
    const timer = setTimeout(() => {
      void this.stop(session);
    }, PREVIEW_TTL_MS);
    timer.unref();
    this.expiryTimers.set(session.sessionId, timer);
  }

  private async stop(session: PreviewSession): Promise<void> {
    const timer = this.expiryTimers.get(session.sessionId);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(session.sessionId);
    this.sessions.delete(session.sessionId);
    await this.adapter.stop(session.sessionId);
  }

  private markStreamUnavailable(session: PreviewSession): void {
    session.status = "failed";
    session.errorCode = "PREVIEW_STREAM_UNAVAILABLE";
    session.message = "Live preview stream is unavailable";
  }

  private toStatusResponse(session: PreviewSession): PreviewStatusResponse {
    return session.status === "failed"
      ? { status: session.status, errorCode: session.errorCode, message: session.message }
      : { status: session.status };
  }
}
