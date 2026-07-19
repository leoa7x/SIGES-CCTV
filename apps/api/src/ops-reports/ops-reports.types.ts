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

export type ReportPreviewPayload = {
  title: string;
  summary: Array<{ label: string; value: string | number }>;
  charts: Array<{
    type: "bar" | "pie" | "line";
    title: string;
    labels: string[];
    values: number[];
  }>;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  findings: string[];
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
