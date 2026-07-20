"use client";

import { OpsReportFilters } from "../../../../components/ops-report-filters";
import { OpsShell } from "../../../../components/ops-shell";

export default function IncidentReportsPage() {
  return (
    <OpsShell eyebrow="Operación" title="Informes de Incidentes">
      <OpsReportFilters
        reportType="INCIDENTS"
        title="Informe oficial de incidentes"
        description="Resume demanda operativa, severidad, estados abiertos y tiempos de resolución para sustentar comités y cierres de servicio."
      />
    </OpsShell>
  );
}
