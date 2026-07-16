import assert from "node:assert/strict";
import test from "node:test";

import { ADMIN_NAV, NAV } from "./sidebar-icons";

test("assigns uploaded sidebar icons only to the routes that already have image files", () => {
  assert.equal(NAV.find((item) => item.href === "/dashboard")?.iconSrc, "/icons/sidebar/dashboard.png");
  assert.equal(NAV.find((item) => item.href === "/monitoring/network")?.iconSrc, "/icons/sidebar/monitoreo-red.png");
  assert.equal(NAV.find((item) => item.href === "/map")?.iconSrc, "/icons/sidebar/mapa-gis.png");
  assert.equal(NAV.find((item) => item.href === "/incidents")?.iconSrc, "/icons/sidebar/incidentes.png");
});

test("maps the newly added admin and logbook icons", () => {
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/cities")?.iconSrc, "/icons/sidebar/ciudades.png");
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/branding")?.iconSrc, "/icons/sidebar/branding.png");
  assert.equal(ADMIN_NAV.find((item) => item.href === "/admin/users")?.iconSrc, "/icons/sidebar/usuarios.png");
  assert.equal(NAV.find((item) => item.href === "/logbook")?.iconSrc, "/icons/sidebar/bitacora.png");
});
