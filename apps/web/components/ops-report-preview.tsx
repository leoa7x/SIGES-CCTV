"use client";

import { OpsReportPreviewResponse } from "../lib/ops-reports";

type OpsReportPreviewProps = {
  preview: OpsReportPreviewResponse | null;
  loading: boolean;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
};

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-ops border border-ops-border bg-ops-surface p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ops-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ops-text">{value}</p>
    </div>
  );
}

export function OpsReportPreview({ preview, loading, canGenerate, generating, onGenerate }: OpsReportPreviewProps) {
  if (loading) {
    return (
      <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
        <div className="flex justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      </section>
    );
  }

  if (!preview) {
    return (
      <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Vista previa</p>
        <h2 className="mt-2 text-lg font-semibold text-ops-text">Sin informe generado todavía</h2>
        <p className="mt-2 text-sm text-ops-muted">
          Define el rango de fechas y los filtros del informe para construir la primera vista previa operativa.
        </p>
      </section>
    );
  }

  const chartMax = Math.max(1, ...preview.charts.flatMap((chart) => chart.values));

  return (
    <section className="space-y-4 rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Vista previa oficial</p>
          <h2 className="mt-2 text-lg font-semibold text-ops-text">{preview.title}</h2>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? "Generando..." : canGenerate ? "Generar PDF + CSV" : "Sin permiso para cerrar corte oficial"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {preview.summary.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {preview.charts.map((chart) => (
          <article key={chart.title} className="rounded-ops border border-ops-border bg-ops-surface p-4">
            <p className="text-sm font-semibold text-ops-text">{chart.title}</p>
            <div className="mt-4 space-y-3">
              {chart.labels.map((label, index) => {
                const value = chart.values[index] ?? 0;
                const width = `${Math.max(6, (value / chartMax) * 100)}%`;
                return (
                  <div key={`${chart.title}-${label}`}>
                    <div className="mb-1 flex items-center justify-between text-xs text-ops-muted">
                      <span>{label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/30">
                      <div className="h-2 rounded-full bg-ops-blue" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="space-y-4">
        {preview.tables.map((table) => (
          <article key={table.title} className="overflow-hidden rounded-ops border border-ops-border">
            <div className="border-b border-ops-border bg-ops-surface px-4 py-3">
              <p className="text-sm font-semibold text-ops-text">{table.title}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-ops-surface text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-ops-muted">
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} className="px-4 py-3">{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ops-border text-ops-text">
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.title}-${rowIndex}`}>
                      {row.map((value, cellIndex) => (
                        <td key={`${table.title}-${rowIndex}-${cellIndex}`} className="px-4 py-3">{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-ops border border-ops-border bg-ops-surface p-4">
        <p className="text-sm font-semibold text-ops-text">Hallazgos ejecutivos</p>
        <ul className="mt-3 space-y-2 text-sm text-ops-text">
          {preview.findings.map((finding) => (
            <li key={finding} className="rounded-ops bg-ops-surface px-3 py-2">{finding}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
