export type OpsReportType = "MONITORING" | "INFRASTRUCTURE" | "INCIDENTS";

export type OpsReportFilters = {
  dateFrom: string;
  dateTo: string;
  cityId?: string | null;
  projectId?: string | null;
  centerId?: string | null;
  nodeId?: string | null;
  severity?: string | null;
  state?: string | null;
};

export type HistoricalArtifactInput = {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
};

export type BrandingSnapshot = {
  profileId: string;
  name: string;
  logoUrl: string | null;
  loginMessage: string | null;
};
