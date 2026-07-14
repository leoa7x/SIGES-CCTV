import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { Injectable } from "@nestjs/common";
import type { CameraPreviewAdapter } from "./camera-preview.adapter";
import type { PreviewConnection, PreviewSession } from "./camera-preview.types";

@Injectable()
export class FfmpegPreviewAdapter implements CameraPreviewAdapter {
  private readonly processes = new Map<string, ChildProcessByStdio<null, Readable, Readable>>();

  async start(session: PreviewSession, connection: PreviewConnection): Promise<void> {
    const sourceUrl = this.withCredentials(connection);
    const child = spawn("ffmpeg", [
      "-nostdin",
      "-rtsp_transport", connection.streamTransport.toLowerCase(),
      "-i", sourceUrl,
      "-f", "mpjpeg",
      "-boundary_tag", "siges-preview",
      "-q:v", "5",
      "pipe:1",
    ], { stdio: ["ignore", "pipe", "pipe"] });

    // Never surface ffmpeg's stderr because it can contain the source URL credentials.
    child.stderr.resume();
    child.once("exit", () => this.processes.delete(session.sessionId));
    child.once("error", () => this.processes.delete(session.sessionId));
    this.processes.set(session.sessionId, child);
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  }

  async stop(sessionId: string): Promise<void> {
    const child = this.processes.get(sessionId);
    if (child && !child.killed) child.kill("SIGTERM");
    this.processes.delete(sessionId);
  }

  getStream(sessionId: string): NodeJS.ReadableStream | null {
    return this.processes.get(sessionId)?.stdout ?? null;
  }

  private withCredentials(connection: PreviewConnection): string {
    const url = new URL(connection.streamUrl);
    if (connection.streamUsername && !url.username) url.username = connection.streamUsername;
    if (connection.streamPassword && !url.password) url.password = connection.streamPassword;
    return url.toString();
  }
}
