"use client";

import { OpsReportFilters } from "../../../../components/ops-report-filters";
import { OpsShell } from "../../../../components/ops-shell";

export default function MonitoringReportsPage() {
  return (
    <OpsShell eyebrow="Operación" title="Informes de Monitoreo">
      <OpsReportFilters
        reportType="MONITORING"
        title="Informe oficial de monitoreo"
        description="Consolida disponibilidad de nodos, presión de alertas, comportamiento de telemetría y eventos de caída en el periodo seleccionado."
      />
    </OpsShell>
  );
}
