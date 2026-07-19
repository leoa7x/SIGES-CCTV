import type { UserRole } from "./session";

export const ALL_PERMISSIONS = [
  "MANAGE_USERS",
  "MANAGE_ORG",
  "MANAGE_ROUTES",
  "MANAGE_NODES",
  "MANAGE_FIBER",
  "MANAGE_CAMERAS",
  "CAMERA_PREVIEW",
  "RUN_DISCOVERY",
  "RESOLVE_DISCOVERY",
  "VIEW_TELEMETRY",
  "REPORTS_VIEW",
  "REPORTS_EXPORT",
  "REPORTS_CLOSE_PERIOD",
  "REPORTS_SCHEDULE",
] as const;

export type UserPermission = (typeof ALL_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<UserPermission, string> = {
  MANAGE_USERS: "Gestionar usuarios",
  MANAGE_ORG: "Gestionar organización",
  MANAGE_ROUTES: "Gestionar rutas",
  MANAGE_NODES: "Gestionar nodos",
  MANAGE_FIBER: "Gestionar fibra",
  MANAGE_CAMERAS: "Gestionar cámaras",
  CAMERA_PREVIEW: "Vista previa de cámaras",
  RUN_DISCOVERY: "Ejecutar discovery",
  RESOLVE_DISCOVERY: "Resolver discovery",
  VIEW_TELEMETRY: "Ver telemetría",
  REPORTS_VIEW: "Ver reportes",
  REPORTS_EXPORT: "Exportar reportes",
  REPORTS_CLOSE_PERIOD: "Cerrar período de reportes",
  REPORTS_SCHEDULE: "Programar reportes",
};

export function shouldRoleUseGranularPermissions(role: UserRole | string) {
  return role !== "SUPER_ADMIN" && role !== "ADMIN";
}

export function normalizePermissionsForRole(
  role: UserRole | string,
  permissions: readonly string[],
): UserPermission[] {
  if (!shouldRoleUseGranularPermissions(role)) {
    return [];
  }

  const allowed = new Set<string>(ALL_PERMISSIONS);
  const unique: UserPermission[] = [];
  for (const permission of permissions) {
    if (allowed.has(permission) && !unique.includes(permission as UserPermission)) {
      unique.push(permission as UserPermission);
    }
  }
  return unique;
}
