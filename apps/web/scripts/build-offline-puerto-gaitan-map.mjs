#!/usr/bin/env node

/*
 * Captures a small, attributable OSM data snapshot for the operational map.
 * This script is run only while assembling the offline installer; the shipped
 * application reads the generated file locally and never contacts Overpass or
 * tile.openstreetmap.org at runtime.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDir, "../public/maps/puerto-gaitan-basemap.geojson");

// Covers all supplied Puerto Gaitán CMC/post coordinates with a safety margin.
const south = 4.285;
const west = -72.125;
const north = 4.34;
const east = -72.015;

const query = `[out:json][timeout:90];
(
  way["highway"](${south},${west},${north},${east});
  way["waterway"](${south},${west},${north},${east});
  way["natural"="water"](${south},${west},${north},${east});
  way["landuse"](${south},${west},${north},${east});
);
out geom;`;

function featureFromWay(element) {
  if (!Array.isArray(element.geometry) || element.geometry.length < 2) return null;
  const tags = element.tags ?? {};
  const kind = tags.highway
    ? "road"
    : tags.waterway
      ? "waterway"
      : tags.natural === "water"
        ? "water"
        : tags.landuse
          ? "landuse"
          : null;
  if (!kind) return null;

  const coordinates = element.geometry.map(({ lon, lat }) => [lon, lat]);
  const isPolygon = kind === "water" || kind === "landuse";
  const closed = coordinates.length > 3
    && coordinates[0][0] === coordinates.at(-1)[0]
    && coordinates[0][1] === coordinates.at(-1)[1];

  return {
    type: "Feature",
    properties: {
      id: element.id,
      kind,
      name: tags.name ?? null,
      highway: tags.highway ?? null,
    },
    geometry: isPolygon && closed
      ? { type: "Polygon", coordinates: [coordinates] }
      : { type: "LineString", coordinates },
  };
}

async function main() {
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      accept: "application/json",
      // A descriptive user agent keeps this one-off, bounded data request
      // identifiable to the public Overpass service.
      "user-agent": "SIGES-CCTV-offline-map-builder/1.0 (Puerto Gaitan deployment)",
    },
    body: new URLSearchParams({ data: query }),
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 180);
    throw new Error(`Overpass returned ${response.status}: ${detail}`);
  }

  const payload = await response.json();
  const features = payload.elements
    .filter((element) => element.type === "way")
    .map(featureFromWay)
    .filter(Boolean);
  if (!features.length) throw new Error("The map snapshot did not contain any renderable features");

  const snapshot = {
    type: "FeatureCollection",
    // ODbL attribution travels with the data bundled by the offline installer.
    properties: {
      title: "Base cartográfica local — Puerto Gaitán",
      source: "© OpenStreetMap contributors, ODbL 1.0",
      capturedAt: new Date().toISOString(),
      bounds: [west, south, east, north],
    },
    features,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`);
  console.log(`Created ${outputPath} with ${features.length} feature(s)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
