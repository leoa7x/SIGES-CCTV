import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLifecycleState,
  formatLoginSupportText,
  formatLoginTitle,
  formatRoleLabel,
  toUserFacingError,
} from "./presentation";

test("formats lifecycle states for operator-facing labels", () => {
  assert.equal(formatLifecycleState("ACTIVE"), "Activo");
  assert.equal(formatLifecycleState("INACTIVE"), "Inactivo");
  assert.equal(formatLifecycleState("ARCHIVED"), "Archivado");
  assert.equal(formatLifecycleState("UNKNOWN"), "UNKNOWN");
});

test("formats role labels for user administration", () => {
  assert.equal(formatRoleLabel("SUPER_ADMIN"), "Superadministrador");
  assert.equal(formatRoleLabel("TECHNICIAN"), "Técnico");
  assert.equal(formatRoleLabel("VIEWER"), "Consulta");
});

test("builds neutral login copy from branding context", () => {
  assert.equal(formatLoginTitle("Gobernación del Meta"), "Acceso operativo");
  assert.equal(
    formatLoginSupportText("Gobernación del Meta"),
    "Ingresa con tu cuenta autorizada para continuar en Gobernación del Meta.",
  );
  assert.equal(
    formatLoginSupportText(null),
    "Ingresa con tu cuenta autorizada para continuar.",
  );
});

test("normalizes UI error messages with fallback copy", () => {
  assert.equal(
    toUserFacingError(new Error("Servicio temporalmente no disponible"), "Error genérico"),
    "Servicio temporalmente no disponible",
  );
  assert.equal(
    toUserFacingError("texto inesperado", "Error genérico"),
    "Error genérico",
  );
});

test("center asset admin errors still map to operator-facing copy", () => {
  const error = new Error("No se pudo guardar el equipo del CMC.");
  assert.equal(toUserFacingError(error, "fallback"), "No se pudo guardar el equipo del CMC.");
});
