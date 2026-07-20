"use client";

import { OpsReportFilters } from "../../../../components/ops-report-filters";
import { OpsShell } from "../../../../components/ops-shell";

export default function InfrastructureReportsPage() {
  return (
    <OpsShell eyebrow="Operación" title="Informes de Inventario e Infraestructura">
      <OpsReportFilters
        reportType="INFRASTRUCTURE"
        title="Informe oficial de infraestructura"
        description="Entrega la composición del inventario, la distribución por CMC, proyecto y nodo, y el estado estructural de la red en un corte histórico."
      />
    </OpsShell>
  );
}
