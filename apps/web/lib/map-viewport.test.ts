import assert from "node:assert/strict";
import test from "node:test";

import { computeMapBounds } from "./map-viewport";

test("computeMapBounds includes CMC coordinates when fitting the GIS viewport", () => {
  const bounds = computeMapBounds(
    [
      { id: "n1", code: "N1", name: "Nodo 1", lat: 4.61, lng: -74.08, operativeState: "ONLINE" },
    ],
    [
      { id: "c1", name: "CMC Principal", address: null, contactName: null, phone: null, lat: 4.7, lng: -74.2 },
    ],
  );

  assert.deepEqual(bounds, [[-74.2, 4.61], [-74.08, 4.7]]);
});

test("computeMapBounds falls back to CMC coordinates when there are no nodes on the map", () => {
  const bounds = computeMapBounds(
    [],
    [
      { id: "c1", name: "CMC Principal", address: null, contactName: null, phone: null, lat: 4.63, lng: -74.09 },
      { id: "c2", name: "CMC Backup", address: null, contactName: null, phone: null, lat: 4.65, lng: -74.05 },
    ],
  );

  assert.deepEqual(bounds, [[-74.09, 4.63], [-74.05, 4.65]]);
});
