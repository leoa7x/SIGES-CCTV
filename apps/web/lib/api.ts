import { clearAuth } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

// A 401 means the JWT is missing/expired/invalid (see JwtStrategy) — the
// session is unrecoverable, so every request helper below forces a logout
// instead of letting each page silently swallow the error and render an
// empty/stale screen indistinguishable from "no data". A 403 is a permission
// problem for an otherwise-valid session and must NOT log the user out.
function handleUnauthorized(status: number) {
  if (status !== 401 || typeof window === "undefined") return;
  clearAuth();
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

export type GrafanaDashboardKey = "node-observability" | "network-command-view";

export type GrafanaEmbedDescriptor = {
  title: string;
  dashboard: GrafanaDashboardKey;
  url: string;
  params: Record<string, string>;
};

export type CameraPreviewSession = {
  sessionId: string;
  status: "starting";
  viewerUrl: string;
  expiresAt: string;
};

export type CameraPreviewStatus = {
  status: "starting" | "live" | "failed" | "expired";
  errorCode?: string;
  message?: string;
};

export type CenterAsset = {
  id: string;
  centerId: string;
  assetType: string;
  name: string;
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  operativeState: string;
  source: string;
  lastSeenAt?: string | null;
  notes?: string | null;
};

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPostNoContent(path: string, token: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API ${res.status} ${path}`);
  }
}

export function startCameraPreview(cameraId: string, token: string): Promise<CameraPreviewSession> {
  return apiPost<CameraPreviewSession>(`/cameras/${cameraId}/preview/start`, token, {});
}

export function pollPreviewStatus(sessionId: string, token: string): Promise<CameraPreviewStatus> {
  return apiGet<CameraPreviewStatus>(`/cameras/preview/${sessionId}/status`, token);
}

export function stopCameraPreview(sessionId: string, token: string): Promise<void> {
  return apiPostNoContent(`/cameras/preview/${sessionId}/stop`, token, {});
}

/** Fetches the protected MJPEG response so the browser can send Bearer auth. */
export async function fetchCameraPreviewMedia(viewerUrl: string, token: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(`${API_URL}${viewerUrl}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API ${res.status} ${viewerUrl}`);
  }
  return res;
}

export async function apiPatch<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `API ${res.status}`);
  }
}

export async function apiPostFile<T>(path: string, token: string, formData: FormData): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getApiUrl() {
  return API_URL;
}
