"use client";

import { useState } from "react";

import { buildHistoryDownloadRows, downloadOpsReportArtifact, OpsReportHistoryItem } from "../lib/ops-reports";
import { toUserFacingError } from "../lib/presentation";

type OpsReportHistoryTableProps = {
  items: OpsReportHistoryItem[];
  loading: boolean;
  accessToken: string | null;
  canDownload: boolean;
};

function formatDateRange(dateFrom: string, dateTo: string) {
  return `${new Date(dateFrom).toLocaleDateString("es-CO")} - ${new Date(dateTo).toLocaleDateString("es-CO")}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO");
}

export function OpsReportHistoryTable({ items, loading, accessToken, canDownload }: OpsReportHistoryTableProps) {
  const [downloadingKey, setDownloadingKey] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const rows = buildHistoryDownloadRows(items, canDownload);

  async function handleDownload(downloadPath: string, key: string) {
    if (!accessToken) return;
    setDownloadingKey(key);
    setDownloadError("");
    try {
      await downloadOpsReportArtifact(accessToken, downloadPath);
    } catch (error) {
      setDownloadError(toUserFacingError(error, "No se pudo descargar el archivo histórico."));
    } finally {
      setDownloadingKey("");
    }
  }

  return (
    <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Histórico oficial</p>
        <h2 className="mt-2 text-lg font-semibold text-ops-text">Cortes ya generados</h2>
        <p className="mt-2 text-sm text-ops-muted">
          Cada informe generado queda trazado con su rango, su origen y los artefactos emitidos.
        </p>
      </div>

      {downloadError ? (
        <div className="mb-4 rounded-ops border border-ops-rose/30 bg-ops-rose/10 px-4 py-3 text-sm text-ops-rose">
          {downloadError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-ops border border-dashed border-ops-border bg-ops-surface px-4 py-8 text-center text-sm text-ops-muted">
          Todavía no existen informes históricos para este módulo.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-ops-surface text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-ops-muted">
              <tr>
                <th className="px-4 py-3">Informe</th>
                <th className="px-4 py-3">Rango</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Emitido</th>
                <th className="px-4 py-3">Artefactos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {rows.map((item) => (
                <tr key={item.id} className="align-top text-ops-text">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-ops-muted">{item.reportType}</p>
                  </td>
                  <td className="px-4 py-3">{formatDateRange(item.dateFrom, item.dateTo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                      item.trigger === "SCHEDULED" ? "bg-ops-blue/10 text-ops-blue" : "bg-ops-amber/10 text-ops-amber"
                    }`}>
                      {item.trigger === "SCHEDULED" ? "Programado" : "Manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ops-muted">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {item.downloads.map((artifact) => {
                        const actionKey = `${item.id}-${artifact.format}`;
                        return (
                          <div key={actionKey} className="rounded-ops border border-ops-border bg-ops-surface px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-ops-text">{artifact.format}</span>
                              <span className="text-[10px] uppercase tracking-[0.14em] text-ops-muted">{artifact.mimeType}</span>
                            </div>
                            <p className="mt-1 text-sm text-ops-text">{artifact.fileName}</p>
                            {artifact.enabled ? (
                              <button
                                type="button"
                                onClick={() => void handleDownload(artifact.downloadPath, actionKey)}
                                disabled={downloadingKey === actionKey}
                                className="mt-1 inline-block text-xs font-semibold text-ops-blue hover:underline disabled:opacity-60"
                              >
                                {downloadingKey === actionKey ? "Descargando..." : "Descargar"}
                              </button>
                            ) : (
                              <p className="mt-1 text-xs text-ops-muted">Tu perfil puede ver el histórico, pero no descargar artefactos.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
