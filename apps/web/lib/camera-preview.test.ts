import assert from "node:assert/strict";
import test from "node:test";
import { getPreviewPhaseLabel } from "./camera-preview";

test("maps API preview statuses into operator labels", () => {
  assert.equal(getPreviewPhaseLabel("starting"), "Conectando...");
  assert.equal(getPreviewPhaseLabel("live"), "Stream activo");
  assert.equal(getPreviewPhaseLabel("failed"), "Sin señal");
  assert.equal(getPreviewPhaseLabel("expired"), "Sesión vencida");
});
