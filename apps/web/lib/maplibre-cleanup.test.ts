import assert from "node:assert/strict";
import test from "node:test";

import { removeMapArtifacts } from "./maplibre-cleanup";

test("removeMapArtifacts tolerates removed MapLibre styles during effect cleanup", () => {
  const removedLayers: string[] = [];
  const removedSources: string[] = [];

  const map = {
    getLayer(id: string) {
      if (id === "fiber-drawing-line") {
        throw new TypeError("Cannot read properties of undefined (reading 'getLayer')");
      }
      return { id };
    },
    removeLayer(id: string) {
      removedLayers.push(id);
    },
    getSource(id: string) {
      if (id === "fiber-drawing") {
        throw new TypeError("Cannot read properties of undefined (reading 'getSource')");
      }
      return { id };
    },
    removeSource(id: string) {
      removedSources.push(id);
    },
  };

  assert.doesNotThrow(() => {
    removeMapArtifacts(map, ["fiber-drawing-line", "fiber-online"], ["fiber-drawing", "fiber-segments"]);
  });

  assert.deepEqual(removedLayers, []);
  assert.deepEqual(removedSources, []);
});
