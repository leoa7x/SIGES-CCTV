import assert from "node:assert/strict";
import test from "node:test";

import {
  formatLifecycleState,
  formatLoginSupportText,
  formatLoginTitle,
  formatRelativeTime,
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

test("toUserFacingError preserves explicit CMC discovery save errors", () => {
  const error = new Error("No se pudo ejecutar el discovery del CMC.");
  assert.equal(toUserFacingError(error, "fallback"), "No se pudo ejecutar el discovery del CMC.");
});

test("formatRelativeTime describes how long ago a timestamp was", () => {
  assert.equal(formatRelativeTime(null), "nunca");
  assert.equal(formatRelativeTime(undefined), "nunca");
  assert.equal(formatRelativeTime("not-a-date"), "nunca");
  assert.equal(formatRelativeTime(new Date(Date.now() - 2_000).toISOString()), "hace instantes");
  assert.equal(formatRelativeTime(new Date(Date.now() - 5 * 60_000).toISOString()), "hace 5 minutos");
  assert.equal(formatRelativeTime(new Date(Date.now() - 60_000).toISOString()), "hace 1 minuto");
  assert.equal(formatRelativeTime(new Date(Date.now() - 3 * 3_600_000).toISOString()), "hace 3 horas");
  assert.equal(formatRelativeTime(new Date(Date.now() - 2 * 86_400_000).toISOString()), "hace 2 días");
});
