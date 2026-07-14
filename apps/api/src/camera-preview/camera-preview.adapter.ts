import type { PreviewConnection, PreviewSession } from "./camera-preview.types";

export interface CameraPreviewAdapter {
  start(session: PreviewSession, connection: PreviewConnection): Promise<void>;
  stop(sessionId: string): Promise<void>;
  getStream(sessionId: string): NodeJS.ReadableStream | null;
}
