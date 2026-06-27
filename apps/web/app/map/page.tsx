"use client";

import { OpsShell } from "../../components/ops-shell";

export default function MapPage() {
  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center rounded-ops border border-ops-border bg-ops-panel text-ops-muted">
        Mapa cargando…
      </div>
    </OpsShell>
  );
}
