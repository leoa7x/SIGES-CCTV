import type { CameraPreviewStatus } from "./api";

const JPEG_START = [0xff, 0xd8];
const JPEG_END = [0xff, 0xd9];

export function getPreviewPhaseLabel(status: CameraPreviewStatus["status"]) {
  switch (status) {
    case "starting": return "Conectando...";
    case "live": return "Stream activo";
    case "failed": return "Sin señal";
    case "expired": return "Sesión vencida";
  }
}

/** Extracts JPEG frames from the ffmpeg MJPEG byte stream returned by the protected API route. */
export async function consumeMjpegFrames(
  stream: ReadableStream<Uint8Array> | null,
  onFrame: (frame: Blob) => void,
): Promise<void> {
  if (!stream) throw new Error("Preview response has no stream body");

  const reader = stream.getReader();
  let pending = new Uint8Array();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      if (!value) continue;

      const next = new Uint8Array(pending.length + value.length);
      next.set(pending);
      next.set(value, pending.length);
      pending = next;

      while (true) {
        const start = findMarker(pending, JPEG_START);
        if (start === -1) {
          pending = pending.slice(-1);
          break;
        }
        const end = findMarker(pending, JPEG_END, start + JPEG_START.length);
        if (end === -1) {
          pending = pending.slice(start);
          break;
        }
        onFrame(new Blob([pending.slice(start, end + JPEG_END.length)], { type: "image/jpeg" }));
        pending = pending.slice(end + JPEG_END.length);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function findMarker(bytes: Uint8Array, marker: number[], from = 0): number {
  for (let index = from; index <= bytes.length - marker.length; index += 1) {
    if (marker.every((value, offset) => bytes[index + offset] === value)) return index;
  }
  return -1;
}
