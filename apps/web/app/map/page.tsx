"use client";

import { useEffect, useState } from "react";
import { OpsShell } from "../../components/ops-shell";
import { useAuth } from "../../components/auth-provider";
import { apiGet } from "../../lib/api";

type NodePoint = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
};

// Leaflet must be loaded client-side only
let MapView: React.ComponentType<{ nodes: NodePoint[] }> | null = null;

export default function MapPage() {
  const { accessToken } = useAuth();
  const [nodes, setNodes] = useState<NodePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ nodes: NodePoint[] }> | null>(null);

  useEffect(() => {
    // Dynamic import of leaflet component (SSR-safe)
    import("../../components/ops-map").then((mod) => {
      setMapComponent(() => mod.OpsMap);
    });
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    apiGet<NodePoint[]>("/nodes/geojson", accessToken)
      .then(setNodes)
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <OpsShell eyebrow="GIS" title="Mapa de Red CCTV">
      <div className="relative h-[calc(100vh-10rem)] w-full overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
        {loading || !MapComponent ? (
          <div className="flex h-full items-center justify-center gap-2 text-ops-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-cyan" />
            Cargando mapa…
          </div>
        ) : (
          <MapComponent nodes={nodes} />
        )}
      </div>
      <p className="mt-2 text-[10px] text-ops-dim">
        {nodes.length} nodos registrados · Haz clic en un marcador para ver detalles
      </p>
    </OpsShell>
  );
}
