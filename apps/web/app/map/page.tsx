"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";
import type { NodeGeo } from "../../components/ops-map-libre";

const OpsMapLibre = dynamic(() => import("../../components/ops-map-libre"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center gap-2 text-ops-muted">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
      Cargando mapa…
    </div>
  ),
});

export default function MapPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<NodeGeo[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<NodeGeo[]>("/nodes/geojson", accessToken).then(setNodes).catch(console.error);
  }, [accessToken]);

  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="relative h-[calc(100vh-10rem)] w-full overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
        <OpsMapLibre nodes={nodes} />
      </div>
      <p className="mt-2 text-[10px] text-ops-dim">
        {nodes.length} nodos registrados · Clic en marcador para detalles
      </p>
    </OpsShell>
  );
}
