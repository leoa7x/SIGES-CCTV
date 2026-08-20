"use client";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../components/auth-provider";
import { OperationsNav } from "../../../components/operations-nav";
import { OpsNotice } from "../../../components/ops-notice";
import { OpsShell } from "../../../components/ops-shell";
import { apiGet, apiPatch, apiPost } from "../../../lib/api";
import { normalizeOpsLifecycleSummary, type OpsLifecycleSummary } from "../../../lib/ops-lifecycle";
import { toUserFacingError } from "../../../lib/presentation";

const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

const RESTORE_SCOPE_LABELS: Record<string, string> = {
  FULL_SYSTEM: "el sistema completo",
  DATABASE_ONLY: "solo la base de datos",
  OBJECTS_ONLY: "solo archivos / objetos",
  CONFIG_ONLY: "solo la configuración",
};

type Feedback = { tone: "info" | "warning" | "error"; title: string; message: string } | null;

export default function OperationsPage() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [runningAction, setRunningAction] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [summary, setSummary] = useState<ReturnType<typeof normalizeOpsLifecycleSummary> | null>(null);
  const [backupRootPath, setBackupRootPath] = useState("");
  const [automaticBackupEnabled, setAutomaticBackupEnabled] = useState(true);
  const [automaticBackupHour, setAutomaticBackupHour] = useState("23");
  const [automaticRetentionCount, setAutomaticRetentionCount] = useState("15");
  const [restorePath, setRestorePath] = useState("");
  const [restoreScope, setRestoreScope] = useState("FULL_SYSTEM");
  const [updateVersionLabel, setUpdateVersionLabel] = useState("");
  const [updatePackagePath, setUpdatePackagePath] = useState("");

  const loadSummary = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = normalizeOpsLifecycleSummary(await apiGet<OpsLifecycleSummary>("/ops-lifecycle", accessToken));
      setSummary(data);
      setBackupRootPath(data.settings.backupRootPath);
      setAutomaticBackupEnabled(data.settings.automaticBackupEnabled);
      setAutomaticBackupHour(String(data.settings.automaticBackupHour));
      setAutomaticRetentionCount(String(data.settings.automaticRetentionCount));
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo cargar Operación",
        message: toUserFacingError(error, "No se pudo cargar la configuración operativa."),
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSavingSettings(true);
    setFeedback(null);
    try {
      await apiPatch("/ops-lifecycle/settings", accessToken, {
        backupRootPath,
        automaticBackupEnabled,
        automaticBackupHour: Number(automaticBackupHour),
        automaticRetentionCount: Number(automaticRetentionCount),
      });
      setFeedback({
        tone: "info",
        title: "Configuración actualizada",
        message: "La política de respaldo diario quedó guardada.",
      });
      await loadSummary();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo guardar la configuración",
        message: toUserFacingError(error, "Revisa la ruta y vuelve a intentarlo."),
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function createBackup(kind: "AUTOMATIC" | "MANUAL_PROTECTED") {
    if (!accessToken) return;
    setRunningAction(kind);
    setFeedback(null);
    try {
      await apiPost("/ops-lifecycle/backups", accessToken, { kind });
      setFeedback({
        tone: "info",
        title: kind === "MANUAL_PROTECTED" ? "Respaldo protegido creado" : "Respaldo ejecutado",
        message: kind === "MANUAL_PROTECTED"
          ? "El respaldo manual protegido quedó registrado fuera de la rotación automática."
          : "El respaldo operativo se ejecutó y quedó registrado en el historial.",
      });
      await loadSummary();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo ejecutar el respaldo",
        message: toUserFacingError(error, "No se pudo completar el respaldo solicitado."),
      });
    } finally {
      setRunningAction("");
    }
  }

  async function restoreBackup(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const scopeLabel = RESTORE_SCOPE_LABELS[restoreScope] ?? restoreScope;
    const confirmed = window.confirm(
      `Vas a restaurar "${scopeLabel}" desde:\n${restorePath}\n\nEsto puede sobrescribir datos actuales de la instalación. ¿Confirmas que quieres continuar?`,
    );
    if (!confirmed) return;

    setRunningAction("RESTORE");
    setFeedback(null);
    try {
      await apiPost("/ops-lifecycle/restores", accessToken, {
        backupPath: restorePath,
        scope: restoreScope,
      });
      setFeedback({
        tone: "warning",
        title: "Restauración registrada",
        message: "La restauración quedó ejecutada. Revisa el estado general del sistema antes de continuar operando.",
      });
      await loadSummary();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo restaurar el respaldo",
        message: toUserFacingError(error, "Verifica la ruta del respaldo y el alcance seleccionado."),
      });
    } finally {
      setRunningAction("");
    }
  }

  async function applyUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    const confirmed = window.confirm(
      `Vas a aplicar la actualización ${updateVersionLabel} desde:\n${updatePackagePath}\n\nSe creará un respaldo previo automático. ¿Confirmas que quieres continuar?`,
    );
    if (!confirmed) return;

    setRunningAction("UPDATE");
    setFeedback(null);
    try {
      await apiPost("/ops-lifecycle/updates", accessToken, {
        versionLabel: updateVersionLabel,
        packagePath: updatePackagePath,
      });
      setFeedback({
        tone: "info",
        title: "Actualización registrada",
        message: "La actualización offline quedó registrada con respaldo previo obligatorio.",
      });
      await loadSummary();
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No se pudo registrar la actualización",
        message: toUserFacingError(error, "Verifica la versión y la ruta del paquete."),
      });
    } finally {
      setRunningAction("");
    }
  }

  return (
    <OpsShell eyebrow="Administración" title="Operación">
      {feedback ? (
        <div className="mb-4">
          <OpsNotice tone={feedback.tone} title={feedback.title} message={feedback.message} onDismiss={() => setFeedback(null)} />
        </div>
      ) : null}

      <div className="mb-6">
        <OperationsNav />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
            <div className="mb-4 flex items-start gap-3">
              <img src="/icons/sidebar/operacion.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-muted">Estado del sistema</h2>
                <p className="mt-2 text-sm text-ops-muted">Resumen rápido del ciclo operativo para respaldos y actualizaciones.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-ops bg-ops-surface p-3 text-sm text-ops-text">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ops-muted">Ruta de respaldo</p>
                <p className="mt-2 break-all">{summary?.settings.backupRootPath || "Sin configurar"}</p>
              </div>
              <div className="rounded-ops bg-ops-surface p-3 text-sm text-ops-text">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ops-muted">Último respaldo</p>
                <p className="mt-2">{summary?.lastBackupLabel ?? "Sin respaldo registrado"}</p>
              </div>
              <div className="rounded-ops bg-ops-surface p-3 text-sm text-ops-text">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ops-muted">Última actualización</p>
                <p className="mt-2">{summary?.lastUpdateLabel ?? "Sin actualización registrada"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-ops border border-ops-blue/30 bg-ops-blue/5 p-5 shadow-ops">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-blue">Pantallas de operación</h2>
                <p className="mt-2 text-sm text-ops-muted">Abre una vista preparada para proyección. Cada botón conserva la sesión actual y se abre en otra pestaña.</p>
              </div>
              <span className="rounded-full border border-ops-blue/30 bg-ops-blue/10 px-2.5 py-1 text-[10px] font-semibold text-ops-blue">MODO MURAL</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <a href="/monitoring/network?mural=1" target="_blank" rel="noreferrer" className="rounded-ops border border-ops-border bg-ops-surface p-4 transition hover:border-ops-blue hover:bg-ops-blue/10">
                <p className="text-sm font-semibold text-ops-text">Recorrido NOC</p>
                <p className="mt-1 text-xs text-ops-muted">Rota automáticamente por todos los nodos y prioriza incidencias.</p>
                <span className="mt-3 inline-block text-xs font-semibold text-ops-blue">Abrir mural →</span>
              </a>
              <a href="/dashboard?mural=1" target="_blank" rel="noreferrer" className="rounded-ops border border-ops-border bg-ops-surface p-4 transition hover:border-ops-blue hover:bg-ops-blue/10">
                <p className="text-sm font-semibold text-ops-text">Vista global de red</p>
                <p className="mt-1 text-xs text-ops-muted">Indicadores generales, cámaras, incidentes y gráficas consolidadas.</p>
                <span className="mt-3 inline-block text-xs font-semibold text-ops-blue">Abrir mural →</span>
              </a>
              <a href="/map?mural=1" target="_blank" rel="noreferrer" className="rounded-ops border border-ops-border bg-ops-surface p-4 transition hover:border-ops-blue hover:bg-ops-blue/10">
                <p className="text-sm font-semibold text-ops-text">Mapa GIS offline</p>
                <p className="mt-1 text-xs text-ops-muted">Mapa de Puerto Gaitán con el estado operativo en vivo.</p>
                <span className="mt-3 inline-block text-xs font-semibold text-ops-blue">Abrir mural →</span>
              </a>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <form onSubmit={saveSettings} className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
              <div className="mb-4 flex items-start gap-3">
                <img src="/icons/sidebar/respaldo.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-muted">Respaldos y restauración</h2>
                  <p className="mt-2 text-sm text-ops-muted">Define la ruta, el horario diario y la retención automática del ciclo de respaldo.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta raíz de respaldo</label>
                  <input className={INPUT} value={backupRootPath} onChange={(e) => setBackupRootPath(e.target.value)} placeholder="D:\SIGES\backups" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Hora respaldo automático</label>
                  <input className={INPUT} type="number" min={0} max={23} value={automaticBackupHour} onChange={(e) => setAutomaticBackupHour(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Retención automática</label>
                  <input className={INPUT} type="number" min={1} max={90} value={automaticRetentionCount} onChange={(e) => setAutomaticRetentionCount(e.target.value)} required />
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm text-ops-text">
                <input type="checkbox" checked={automaticBackupEnabled} onChange={(e) => setAutomaticBackupEnabled(e.target.checked)} />
                Habilitar respaldo automático diario
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="submit" disabled={savingSettings} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-60">
                  {savingSettings ? "Guardando..." : "Guardar política"}
                </button>
                <button type="button" disabled={runningAction !== ""} onClick={() => void createBackup("AUTOMATIC")} className="rounded-ops border border-ops-border px-4 py-2 text-sm font-semibold text-ops-text hover:border-ops-blue hover:text-ops-blue disabled:opacity-60">
                  {runningAction === "AUTOMATIC" ? "Ejecutando..." : "Ejecutar respaldo ahora"}
                </button>
                <button type="button" disabled={runningAction !== ""} onClick={() => void createBackup("MANUAL_PROTECTED")} className="rounded-ops border border-ops-amber/40 bg-ops-amber/10 px-4 py-2 text-sm font-semibold text-ops-amber hover:bg-ops-amber/20 disabled:opacity-60">
                  {runningAction === "MANUAL_PROTECTED" ? "Creando..." : "Crear respaldo protegido"}
                </button>
              </div>
            </form>

            <form onSubmit={restoreBackup} className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-muted">Restaurar respaldo</h2>
              <p className="mt-2 text-sm text-ops-muted">Aplica un respaldo existente sobre esta instalación SIGES sin reinstalar toda la plataforma.</p>
              <div className="mt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta del respaldo</label>
                  <input className={INPUT} value={restorePath} onChange={(e) => setRestorePath(e.target.value)} placeholder="D:\SIGES\backups\2026-07-16_23-00-00" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Alcance</label>
                  <select className={INPUT} value={restoreScope} onChange={(e) => setRestoreScope(e.target.value)}>
                    <option value="FULL_SYSTEM">Sistema completo</option>
                    <option value="DATABASE_ONLY">Solo base de datos</option>
                    <option value="OBJECTS_ONLY">Solo archivos / objetos</option>
                    <option value="CONFIG_ONLY">Solo configuración</option>
                  </select>
                </div>
                <button type="submit" disabled={runningAction !== ""} className="rounded-ops border border-ops-border px-4 py-2 text-sm font-semibold text-ops-text hover:border-ops-blue hover:text-ops-blue disabled:opacity-60">
                  {runningAction === "RESTORE" ? "Restaurando..." : "Iniciar restauración"}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
            <div className="mb-4 flex items-start gap-3">
              <img src="/icons/sidebar/actualizacion.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-ops-muted">Actualizaciones offline</h2>
                <p className="mt-2 text-sm text-ops-muted">Registra un paquete de actualización offline. El sistema debe crear un respaldo previo antes de aplicar cambios.</p>
              </div>
            </div>
            <form onSubmit={applyUpdate} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Versión objetivo</label>
                <input className={INPUT} value={updateVersionLabel} onChange={(e) => setUpdateVersionLabel(e.target.value)} placeholder="2026.07.16" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Ruta del paquete</label>
                <input className={INPUT} value={updatePackagePath} onChange={(e) => setUpdatePackagePath(e.target.value)} placeholder="D:\SIGES\updates\SIGES-Update-2026.07.16.exe" required />
              </div>
              <div className="md:col-span-2">
                <button type="submit" disabled={runningAction !== ""} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-60">
                  {runningAction === "UPDATE" ? "Registrando..." : "Registrar actualización"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </OpsShell>
  );
}
