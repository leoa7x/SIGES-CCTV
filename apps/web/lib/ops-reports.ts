import { apiDownload, apiGet, apiPost } from "./api";

export type OpsReportType = "MONITORING" | "INFRASTRUCTURE" | "INCIDENTS";
export type OpsReportFormat = "PDF" | "CSV";

export type OpsReportRequestInput = {
  reportType: OpsReportType;
  dateFrom: string;
  dateTo: string;
  cityId?: string;
  projectId?: string;
  centerId?: string;
  nodeId?: string;
  severity?: string;
  state?: string;
};

export type OpsReportPreviewResponse = {
  title: string;
  summary: Array<{ label: string; value: string | number }>;
  charts: Array<{ type: string; title: string; labels: string[]; values: number[] }>;
  tables: Array<{ title: string; columns: string[]; rows: string[][] }>;
  findings: string[];
};

export type OpsReportHistoryItem = {
  id: string;
  reportType: OpsReportType;
  title: string;
  dateFrom: string;
  dateTo: string;
  trigger: "MANUAL" | "SCHEDULED";
  createdAt: string;
  artifacts: Array<{ format: OpsReportFormat; fileName: string; downloadPath: string; mimeType: string }>;
};

export type OpsHistoryDownloadRow = OpsReportHistoryItem & {
  downloads: Array<{
    format: OpsReportFormat;
    fileName: string;
    downloadPath: string;
    mimeType: string;
    enabled: boolean;
  }>;
};

export type OpsReportScheduleInput = ReturnType<typeof buildReportRequest> & {
  frequency: "WEEKLY" | "MONTHLY";
  titleTemplate: string;
  relativeRange: { days: number };
};

function emptyToNull(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildReportRequest(input: OpsReportRequestInput) {
  return {
    reportType: input.reportType,
    filters: {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      cityId: emptyToNull(input.cityId),
      projectId: emptyToNull(input.projectId),
      centerId: emptyToNull(input.centerId),
      nodeId: emptyToNull(input.nodeId),
      severity: emptyToNull(input.severity),
      state: emptyToNull(input.state),
    },
  };
}

export function previewOpsReport(token: string, request: ReturnType<typeof buildReportRequest>) {
  return apiPost<OpsReportPreviewResponse>("/ops-lifecycle/reports/preview", token, request);
}

export function generateOpsReport(token: string, request: ReturnType<typeof buildReportRequest>) {
  return apiPost<{ reportId: string }>("/ops-lifecycle/reports/generate", token, request);
}

export function listOpsReportHistory(token: string, reportType: OpsReportType) {
  return apiGet<OpsReportHistoryItem[]>(`/ops-lifecycle/reports/history?reportType=${reportType}`, token);
}

export function createOpsReportSchedule(token: string, request: OpsReportScheduleInput) {
  return apiPost<{ id: string }>("/ops-lifecycle/reports/schedules", token, request);
}

export function buildHistoryDownloadRows(items: OpsReportHistoryItem[], canDownload: boolean): OpsHistoryDownloadRow[] {
  return items.map((item) => ({
    ...item,
    downloads: item.artifacts.map((artifact) => ({
      ...artifact,
      enabled: canDownload,
    })),
  }));
}

export async function downloadOpsReportArtifact(token: string, downloadPath: string) {
  const { blob, fileName } = await apiDownload(downloadPath, token);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName ?? "reporte";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
