"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth-provider";
import { OperationsNav } from "./operations-nav";
import { OpsNotice } from "./ops-notice";
import { apiGet } from "../lib/api";
import {
  buildReportRequest,
  createOpsReportSchedule,
  generateOpsReport,
  listOpsReportHistory,
  type OpsReportHistoryItem,
  type OpsReportPreviewResponse,
  type OpsReportType,
  previewOpsReport,
} from "../lib/ops-reports";
import { toUserFacingError } from "../lib/presentation";
import { shouldRoleUseGranularPermissions } from "../lib/user-permissions";
import { OpsReportHistoryTable } from "./ops-report-history-table";
import { OpsReportPreview } from "./ops-report-preview";

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

type CityRef = { id: string; name: string };
type ProjectRef = { id: string; name: string; city: { id: string } };
type CenterRef = { id: string; name: string; project: { id: string } };
type NodeRef = { id: string; name: string; code: string; route: { center: { name: string } } | null };

type OpsReportFiltersProps = {
  reportType: OpsReportType;
  title: string;
  description: string;
};

function isoDateOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function canUsePermission(role: string, permissions: string[], permission: string) {
  return !shouldRoleUseGranularPermissions(role) || permissions.includes(permission as any);
}

export function OpsReportFilters({ reportType, title, description }: OpsReportFiltersProps) {
  const { accessToken, user } = useAuth();
  const [cities, setCities] = useState<CityRef[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [centers, setCenters] = useState<CenterRef[]>([]);
  const [nodes, setNodes] = useState<NodeRef[]>([]);
  const [history, setHistory] = useState<OpsReportHistoryItem[]>([]);
  const [preview, setPreview] = useState<OpsReportPreviewResponse | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "info" | "warning" | "error"; title: string; message: string } | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [dateFrom, setDateFrom] = useState(isoDateOffset(-7));
  const [dateTo, setDateTo] = useState(isoDateOffset(0));
  const [cityId, setCityId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [centerId, setCenterId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [severity, setSeverity] = useState("");
  const [state, setState] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [scheduleDays, setScheduleDays] = useState(reportType === "INCIDENTS" ? "30" : "7");
  const [scheduleTitle, setScheduleTitle] = useState(title);

  const canView = user ? canUsePermission(user.role, user.permissions, "REPORTS_VIEW") : false;
  const canDownload = user ? canUsePermission(user.role, user.permissions, "REPORTS_EXPORT") : false;
  const canClosePeriod = user ? canUsePermission(user.role, user.permissions, "REPORTS_CLOSE_PERIOD") : false;
  const canSchedule = user ? canUsePermission(user.role, user.permissions, "REPORTS_SCHEDULE") : false;
  const selectedCenter = useMemo(
    () => centers.find((center) => center.id === centerId) ?? null,
    [centers, centerId],
  );

  const visibleProjects = useMemo(
    () => projects.filter((project) => !cityId || project.city.id === cityId),
    [projects, cityId],
  );
  const visibleCenters = useMemo(
    () => centers.filter((center) => !projectId || center.project.id === projectId),
    [centers, projectId],
  );
  const visibleNodes = useMemo(
    () => nodes.filter((node) => !selectedCenter || node.route?.center.name === selectedCenter.name),
    [nodes, selectedCenter],
  );

  const loadReferences = useCallback(async () => {
    if (!accessToken || !canView) return;
    setLoadingRefs(true);
    try {
      const [cityData, projectData, centerData, nodeData] = await Promise.all([
        apiGet<CityRef[]>("/cities", accessToken),
        apiGet<ProjectRef[]>("/projects", accessToken),
        apiGet<CenterRef[]>("/monitoring-centers", accessToken),
        apiGet<NodeRef[]>("/nodes", accessToken),
      ]);
      setCities(cityData);
      setProjects(projectData);
      setCenters(centerData);
      setNodes(nodeData);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudieron cargar los catálogos",
        message: toUserFacingError(error, "No fue posible cargar los filtros de organización."),
      });
    } finally {
      setLoadingRefs(false);
    }
  }, [accessToken, canView]);

  const loadHistory = useCallback(async () => {
    if (!accessToken || !canView) return;
    setLoadingHistory(true);
    try {
      setHistory(await listOpsReportHistory(accessToken, reportType));
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo cargar el histórico",
        message: toUserFacingError(error, "No fue posible leer los informes ya emitidos."),
      });
    } finally {
      setLoadingHistory(false);
    }
  }, [accessToken, canView, reportType]);

  useEffect(() => {
    void Promise.all([loadReferences(), loadHistory()]);
  }, [loadReferences, loadHistory]);

  function currentRequest() {
    return buildReportRequest({
      reportType,
      dateFrom,
      dateTo,
      cityId,
      projectId,
      centerId,
      nodeId,
      severity,
      state,
    });
  }

  async function handlePreview(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setPreviewing(true);
    setFeedback(null);
    try {
      setPreview(await previewOpsReport(accessToken, currentRequest()));
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo construir la vista previa",
        message: toUserFacingError(error, "Revisa el rango operativo e inténtalo de nuevo."),
      });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate() {
    if (!accessToken) return;
    setGenerating(true);
    setFeedback(null);
    try {
      await generateOpsReport(accessToken, currentRequest());
      setFeedback({
        tone: "info",
        title: "Informe generado",
        message: "El corte oficial quedó emitido y agregado al histórico documental.",
      });
      await loadHistory();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo generar el informe",
        message: toUserFacingError(error, "La exportación oficial no se completó."),
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSchedule(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    setScheduling(true);
    setFeedback(null);
    try {
      await createOpsReportSchedule(accessToken, {
        ...currentRequest(),
        frequency: scheduleFrequency,
        titleTemplate: scheduleTitle,
        relativeRange: { days: Number(scheduleDays) },
      });
      setFeedback({
        tone: "info",
        title: "Programación registrada",
        message: "El informe quedó agendado para generarse como corte oficial recurrente.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo programar el informe",
        message: toUserFacingError(error, "No fue posible guardar la programación solicitada."),
      });
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="space-y-6">
      <OperationsNav />

      {feedback ? (
        <OpsNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onDismiss={() => setFeedback(null)} />
      ) : null}

      {!canView ? (
        <OpsNotice
          tone="warning"
          title="Sin permiso para consultar informes"
          message="Tu perfil actual no tiene habilitado el acceso a reportes operativos."
        />
      ) : (
        <>
          <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <form onSubmit={handlePreview} className="space-y-4 rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Diseño del informe</p>
                <h2 className="mt-2 text-lg font-semibold text-ops-text">{title}</h2>
                <p className="mt-2 text-sm text-ops-muted">{description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Fecha desde</label>
                  <input className={INPUT} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Fecha hasta</label>
                  <input className={INPUT} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ciudad</label>
                  <select className={INPUT} value={cityId} onChange={(e) => { setCityId(e.target.value); setProjectId(""); setCenterId(""); setNodeId(""); }} disabled={loadingRefs}>
                    <option value="">Todas</option>
                    {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Proyecto</label>
                  <select className={INPUT} value={projectId} onChange={(e) => { setProjectId(e.target.value); setCenterId(""); setNodeId(""); }} disabled={loadingRefs}>
                    <option value="">Todos</option>
                    {visibleProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">CMC</label>
                  <select className={INPUT} value={centerId} onChange={(e) => { setCenterId(e.target.value); setNodeId(""); }} disabled={loadingRefs}>
                    <option value="">Todos</option>
                    {visibleCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Nodo</label>
                  <select className={INPUT} value={nodeId} onChange={(e) => setNodeId(e.target.value)} disabled={loadingRefs}>
                    <option value="">Todos</option>
                    {visibleNodes.map((node) => <option key={node.id} value={node.id}>{node.code} · {node.name}</option>)}
                  </select>
                </div>
                {reportType === "INCIDENTS" ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Severidad</label>
                      <select className={INPUT} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                        <option value="">Todas</option>
                        <option value="LOW">Baja</option>
                        <option value="MEDIUM">Media</option>
                        <option value="HIGH">Alta</option>
                        <option value="CRITICAL">Crítica</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
                      <select className={INPUT} value={state} onChange={(e) => setState(e.target.value)}>
                        <option value="">Todos</option>
                        <option value="OPEN">Abierto</option>
                        <option value="IN_PROGRESS">En curso</option>
                        <option value="RESOLVED">Resuelto</option>
                      </select>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={previewing} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-60">
                  {previewing ? "Calculando..." : "Construir vista previa"}
                </button>
              </div>
            </form>

            <OpsReportPreview
              preview={preview}
              loading={previewing}
              canGenerate={canClosePeriod}
              generating={generating}
              onGenerate={() => void handleGenerate()}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <OpsReportHistoryTable items={history} loading={loadingHistory} accessToken={accessToken} canDownload={canDownload} />

            <form onSubmit={handleSchedule} className="space-y-4 rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Programación</p>
                <h2 className="mt-2 text-lg font-semibold text-ops-text">Corte automático</h2>
                <p className="mt-2 text-sm text-ops-muted">
                  Define si este informe debe quedar emitiéndose solo como corte semanal o mensual.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Título oficial</label>
                <input className={INPUT} value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} required />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Frecuencia</label>
                  <select className={INPUT} value={scheduleFrequency} onChange={(e) => setScheduleFrequency(e.target.value as "WEEKLY" | "MONTHLY")}>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ventana móvil (días)</label>
                  <input className={INPUT} type="number" min={1} max={365} value={scheduleDays} onChange={(e) => setScheduleDays(e.target.value)} required />
                </div>
              </div>
              <button
                type="submit"
                disabled={!canSchedule || scheduling}
                className="rounded-ops border border-ops-border px-4 py-2 text-sm font-semibold text-ops-text hover:border-ops-blue hover:text-ops-blue disabled:cursor-not-allowed disabled:opacity-60"
              >
                {scheduling ? "Programando..." : canSchedule ? "Guardar programación" : "Sin permiso para programar"}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
