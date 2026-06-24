"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

type NodePoint = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
};

const stateColor: Record<string, string> = {
  ONLINE:      "#10b981",
  DEGRADED:    "#f59e0b",
  OFFLINE:     "#f43f5e",
  MAINTENANCE: "#64748b",
};

type Props = { nodes: NodePoint[] };

export function OpsMap({ nodes }: Props) {
  const center: [number, number] = nodes.length > 0
    ? [nodes[0].lat, nodes[0].lng]
    : [4.5981, -74.0758]; // Bogotá default

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%", background: "#0e1724" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
      />
      {nodes.map((node) => (
        <CircleMarker
          key={node.id}
          center={[node.lat, node.lng]}
          radius={8}
          pathOptions={{
            color: stateColor[node.operativeState] ?? "#64748b",
            fillColor: stateColor[node.operativeState] ?? "#64748b",
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#0e1724" }}>
              <strong>{node.code}</strong><br />
              {node.name}<br />
              <span style={{ color: stateColor[node.operativeState] }}>{node.operativeState}</span>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
