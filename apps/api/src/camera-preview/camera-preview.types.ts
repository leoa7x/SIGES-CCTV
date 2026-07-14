export type PreviewStatus = "starting" | "live" | "failed" | "expired";

export type PreviewConnection = {
  streamUrl: string;
  streamUsername?: string | null;
  streamPassword?: string | null;
  streamTransport: "TCP" | "UDP";
};

export type PreviewSession = {
  sessionId: string;
  cameraId: string;
  userId: string;
  status: PreviewStatus;
  expiresAt: Date;
  errorCode?: string;
  message?: string;
};

export type PreviewStartResponse = {
  sessionId: string;
  status: "starting";
  viewerUrl: string;
  expiresAt: string;
};

export type PreviewStatusResponse = Pick<PreviewSession, "status" | "errorCode" | "message">;
