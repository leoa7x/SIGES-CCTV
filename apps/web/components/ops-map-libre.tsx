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
  hasPole?: boolean;
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

export type FiberSegmentGeo = {
  id: string;
  state: "ACTIVE" | "CUT" | "DEGRADED" | "MAINTENANCE";
  nodeA: { id: string; code: string; lat: number; lng: number; operativeState: string };
  nodeB: { id: string; code: string; lat: number; lng: number; operativeState: string };
  waypoints: number[][];
};

const DASH_SEQ: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5],
  [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

function computeEffectiveState(seg: FiberSegmentGeo): "ONLINE" | "DEGRADED" | "OFFLINE" {
  if (
    seg.nodeA.operativeState === "OFFLINE" ||
    seg.nodeB.operativeState === "OFFLINE" ||
    seg.state === "CUT"
  )
    return "OFFLINE";
  if (seg.nodeA.operativeState === "DEGRADED" || seg.nodeB.operativeState === "DEGRADED")
    return "DEGRADED";
  return "ONLINE";
}

function buildFiberGeoJson(segments: FiberSegmentGeo[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: segments
      .filter(
        (s) =>
          !(s.nodeA.lat === 0 && s.nodeA.lng === 0) &&
          !(s.nodeB.lat === 0 && s.nodeB.lng === 0)
      )
      .map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [
            [s.nodeA.lng, s.nodeA.lat],
            ...(s.waypoints as [number, number][]),
            [s.nodeB.lng, s.nodeB.lat],
          ],
        },
        properties: {
          id: s.id,
          effectiveState: computeEffectiveState(s),
          nodeAId: s.nodeA.id,
          nodeBId: s.nodeB.id,
          nodeACode: s.nodeA.code,
          nodeBCode: s.nodeB.code,
        },
      })),
  };
}

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
  fiberSegments = [],
  fiberDrawMode = false,
  onFiberPoleClick,
  onFiberMapClick,
  onFiberDblClick,
  drawingPreview,
}: {
  nodes: NodeGeo[];
  centers?: CenterGeo[];
  onPlaceNode?: (lat: number, lng: number) => void;
  fiberSegments?: FiberSegmentGeo[];
  fiberDrawMode?: boolean;
  onFiberPoleClick?: (nodeId: string, lat: number, lng: number) => void;
  drawingPreview?: [number, number][];
  onFiberMapClick?: (lat: number, lng: number) => void;
  onFiberDblClick?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  // Mutable ref so the circle click handler can check placement mode without
  // triggering the heavy nodes useEffect on every onPlaceNode change.
  const onPlaceNodeRef = useRef(onPlaceNode);
  useEffect(() => { onPlaceNodeRef.current = onPlaceNode; }, [onPlaceNode]);
  const centerMarkersRef = useRef<maplibregl.Marker[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const fiberDrawModeRef = useRef(fiberDrawMode);
  useEffect(() => { fiberDrawModeRef.current = fiberDrawMode; }, [fiberDrawMode]);
  const onFiberPoleClickRef = useRef(onFiberPoleClick);
  useEffect(() => { onFiberPoleClickRef.current = onFiberPoleClick; }, [onFiberPoleClick]);
  const onFiberMapClickRef = useRef(onFiberMapClick);
  useEffect(() => { onFiberMapClickRef.current = onFiberMapClick; }, [onFiberMapClick]);
  const onFiberDblClickRef = useRef(onFiberDblClick);
  useEffect(() => { onFiberDblClickRef.current = onFiberDblClick; }, [onFiberDblClick]);

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
          hasPole: n.hasPole ?? false,
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
        if (fiberDrawModeRef.current) return;
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
        if (fiberDrawModeRef.current) return;
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "nodes-circle", () => {
        if (onPlaceNodeRef.current) return;
        if (fiberDrawModeRef.current) return;
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

  // Fiber layer setup — sources, layers, and animation loop
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Empty source — data is filled by the sibling effect below
    map.addSource("fiber-segments", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addSource("fiber-drawing", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    const beforeId = map.getLayer("nodes-circle") ? "nodes-circle" : undefined;

    // Pole halo — highlights hasPole nodes during drawing mode (hidden by default)
    map.addLayer(
      {
        id: "nodes-pole-halo",
        type: "circle",
        source: "nodes",
        filter: ["==", ["get", "hasPole"], true],
        paint: {
          "circle-radius": 14,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        layout: { visibility: "none" },
      },
      beforeId
    );

    map.addLayer(
      {
        id: "fiber-offline",
        type: "line",
        source: "fiber-segments",
        filter: ["==", ["get", "effectiveState"], "OFFLINE"],
        paint: { "line-color": "#f43f5e", "line-width": 4 },
      },
      beforeId
    );

    map.addLayer(
      {
        id: "fiber-degraded",
        type: "line",
        source: "fiber-segments",
        filter: ["==", ["get", "effectiveState"], "DEGRADED"],
        paint: { "line-color": "#f59e0b", "line-width": 3 },
      },
      beforeId
    );

    map.addLayer(
      {
        id: "fiber-online",
        type: "line",
        source: "fiber-segments",
        filter: ["==", ["get", "effectiveState"], "ONLINE"],
        paint: {
          "line-color": "#10b981",
          "line-width": 3,
          "line-dasharray": DASH_SEQ[0],
        },
      },
      beforeId
    );

    map.addLayer({
      id: "fiber-drawing-line",
      type: "line",
      source: "fiber-drawing",
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2,
        "line-dasharray": [4, 3],
      },
    });

    // Animation loop — only mutates fiber-online paint, cheap when nothing is ONLINE
    const liveMap = map;
    let step = 0;
    let lastTs = 0;
    function tick(ts: number) {
      if (ts - lastTs > 80) {
        step = (step + 1) % DASH_SEQ.length;
        if (liveMap.getLayer("fiber-online")) {
          liveMap.setPaintProperty("fiber-online", "line-dasharray", DASH_SEQ[step]);
        }
        lastTs = ts;
      }
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      ["fiber-drawing-line", "nodes-pole-halo", "fiber-online", "fiber-degraded", "fiber-offline"]
        .forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      ["fiber-drawing", "fiber-segments"]
        .forEach((id) => { if (map.getSource(id)) map.removeSource(id); });
    };
  }, [mapReady]);

  // Push new fiber GeoJSON whenever fiberSegments changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource("fiber-segments") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildFiberGeoJson(fiberSegments));
  }, [fiberSegments, mapReady]);

  // Update drawing preview line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const coords = drawingPreview ?? [];
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features:
        coords.length >= 2
          ? [
              {
                type: "Feature",
                geometry: { type: "LineString", coordinates: coords },
                properties: {},
              },
            ]
          : [],
    };
    const src = map.getSource("fiber-drawing") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(geojson);
  }, [drawingPreview, mapReady]);

  // Drawing mode: cursor, pole halos, click/dblclick handlers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Toggle pole halo visibility
    if (map.getLayer("nodes-pole-halo")) {
      map.setLayoutProperty(
        "nodes-pole-halo",
        "visibility",
        fiberDrawMode ? "visible" : "none"
      );
    }

    if (!fiberDrawMode) {
      map.getCanvas().style.cursor = "";
      return;
    }

    map.getCanvas().style.cursor = "crosshair";

    const handlePoleClick = (e: maplibregl.MapLayerMouseEvent) => {
      e.preventDefault();
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties as { id: string };
      const coords = (feat.geometry as GeoJSON.Point).coordinates;
      onFiberPoleClickRef.current?.(p.id, coords[1], coords[0]);
    };

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ["nodes-circle"] });
      if (hits.length > 0) return;
      onFiberMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    };

    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      onFiberDblClickRef.current?.();
    };

    map.on("click", "nodes-circle", handlePoleClick);
    map.on("click", handleMapClick);
    map.on("dblclick", handleDblClick);

    return () => {
      map.off("click", "nodes-circle", handlePoleClick);
      map.off("click", handleMapClick);
      map.off("dblclick", handleDblClick);
      map.getCanvas().style.cursor = "";
    };
  }, [fiberDrawMode, mapReady]);

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
