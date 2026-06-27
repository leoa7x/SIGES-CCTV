"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

export type NodeGeo = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  operativeState: string;
};

export type CenterGeo = {
  id: string;
  name: string;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  lat: number;
  lng: number;
};

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
};

export default function OpsMapLibre({
  nodes,
  centers,
  onPlaceNode,
}: {
  nodes: NodeGeo[];
  centers?: CenterGeo[];
  onPlaceNode?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Mutable ref so the circle click handler can check placement mode without
  // triggering the heavy nodes useEffect on every onPlaceNode change.
  const onPlaceNodeRef = useRef(onPlaceNode);
  useEffect(() => { onPlaceNodeRef.current = onPlaceNode; }, [onPlaceNode]);
  const centerMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [-74.0758, 4.5981], // Bogotá default
      zoom: 12,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => setMapReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update nodes source whenever nodes or mapReady changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: nodes.map((n) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [n.lng, n.lat] },
        properties: {
          id: n.id,
          code: n.code,
          name: n.name,
          state: n.operativeState,
        },
      })),
    };

    const src = map.getSource("nodes") as maplibregl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geojson);
    } else {
      map.addSource("nodes", { type: "geojson", data: geojson });

      map.addLayer({
        id: "nodes-circle",
        type: "circle",
        source: "nodes",
        paint: {
          "circle-radius": 9,
          "circle-color": [
            "match", ["get", "state"],
            "ONLINE",      "#10b981",
            "DEGRADED",    "#f59e0b",
            "OFFLINE",     "#f43f5e",
            "MAINTENANCE", "#64748b",
            "#94a3b8",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0A2540",
          "circle-opacity": 0.9,
        },
      });

      map.on("click", "nodes-circle", (e) => {
        // Suppress popup while placement mode is active
        if (onPlaceNodeRef.current) return;
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as { code: string; name: string; state: string };
        const stateHex: Record<string, string> = {
          ONLINE: "#10b981", DEGRADED: "#f59e0b", OFFLINE: "#f43f5e", MAINTENANCE: "#64748b",
        };
        new maplibregl.Popup({ className: "ops-popup" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:12px/1.4 Arial,sans-serif;padding:4px 2px;color:#e2e8f0;background:#0A2540">` +
            `<strong style="color:#e2e8f0">${p.code}</strong><br/>${p.name}<br/>` +
            `<span style="color:${stateHex[p.state] ?? "#94a3b8"}">${p.state}</span></div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "nodes-circle", () => {
        if (onPlaceNodeRef.current) return;
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "nodes-circle", () => {
        if (onPlaceNodeRef.current) return;
        map.getCanvas().style.cursor = "";
      });

      if (nodes.length > 0) {
        const lngs = nodes.map((n) => n.lng);
        const lats = nodes.map((n) => n.lat);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 14 }
        );
      }
    }
  }, [nodes, mapReady]);

  // Placement mode: crosshair cursor + capture one map click
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!onPlaceNode) {
      map.getCanvas().style.cursor = "";
      return;
    }
    map.getCanvas().style.cursor = "crosshair";
    const handler = (e: maplibregl.MapMouseEvent) => {
      onPlaceNode(e.lngLat.lat, e.lngLat.lng);
    };
    map.once("click", handler);
    return () => {
      map.off("click", handler);
      map.getCanvas().style.cursor = "";
    };
  }, [onPlaceNode, mapReady]);

  // Render CMC markers as blue squares
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Remove previous markers
    centerMarkersRef.current.forEach((m) => m.remove());
    centerMarkersRef.current = [];

    (centers ?? []).forEach((c) => {
      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;background:#1D4ED8;border:2px solid #fff;border-radius:3px;cursor:pointer;";
      el.title = c.name;

      const popup = new maplibregl.Popup({ offset: 12, className: "ops-popup" }).setHTML(
        `<div style="font:12px/1.6 Arial,sans-serif;padding:4px 2px;color:#e2e8f0;background:#0A2540;min-width:140px">` +
        `<strong style="color:#93c5fd;display:block;margin-bottom:2px">CMC</strong>` +
        `<strong style="color:#e2e8f0">${c.name}</strong>` +
        (c.address ? `<br/><span style="color:#94a3b8">${c.address}</span>` : "") +
        (c.contactName ? `<br/><span style="color:#94a3b8">${c.contactName}</span>` : "") +
        (c.phone ? `<br/><span style="color:#94a3b8">${c.phone}</span>` : "") +
        `</div>`,
      );

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([c.lng, c.lat])
        .setPopup(popup)
        .addTo(map);

      centerMarkersRef.current.push(marker);
    });

    return () => {
      centerMarkersRef.current.forEach((m) => m.remove());
      centerMarkersRef.current = [];
    };
  }, [centers, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
