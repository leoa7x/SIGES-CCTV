import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_NAV, getVisibleAdminNav, NAV } from "./sidebar-icons";

test("assigns uploaded sidebar icons only to the routes that already have image files", () => {
  assert.equal(NAV.find((item) => item.href === "/dashboard")?.iconSrc, "/icons/sidebar/dashboard.png");
  assert.equal(NAV.find((item) => item.href === "/monitoring/network")?.iconSrc, "/icons/sidebar/monitoreo-red.png");
  assert.equal(NAV.find((item) => item.href === "/map")?.iconSrc, "/icons/sidebar/mapa-gis.png");
  assert.equal(NAV.find((item) => item.href === "/incidents")?.iconSrc, "/icons/sidebar/incidentes.png");
});

test("maps the newly added admin and logbook icons", () => {
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/cities")?.iconSrc, "/icons/sidebar/ciudades.png");
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/branding")?.iconSrc, "/icons/sidebar/branding.png");
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/operations")?.iconSrc, "/icons/sidebar/operacion.png");
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/users")?.iconSrc, "/icons/sidebar/usuarios.png");
  assert.equal(NAV.find((item) => item.href === "/logbook")?.iconSrc, "/icons/sidebar/bitacora.png");
});

test("getVisibleAdminNav shows every admin item to SUPER_ADMIN/ADMIN regardless of their permissions array", () => {
  assert.equal(getVisibleAdminNav("SUPER_ADMIN", []).length, ADMIN_NAV.length);
  assert.equal(getVisibleAdminNav("ADMIN", []).length, ADMIN_NAV.length);
});

test("getVisibleAdminNav only shows a non-admin role the items backed by a permission they hold", () => {
  const visible = getVisibleAdminNav("SUPERVISOR", ["MANAGE_CAMERAS"]);

  assert.deepEqual(visible.map((item) => item.href), ["/admin/cameras"]);
});

test("getVisibleAdminNav shows nothing to a non-admin role with no granted permissions", () => {
  assert.deepEqual(getVisibleAdminNav("VIEWER", []), []);
});

test("every ADMIN_NAV item is backed by a permission so it can be discovered without knowing the role", () => {
  for (const item of ADMIN_NAV) {
    assert.ok(item.permission, `${item.href} is missing a permission mapping`);
  }
});
