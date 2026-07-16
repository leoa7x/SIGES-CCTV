import { shouldRoleUseGranularPermissions, type UserPermission } from "./user-permissions";
import type { UserRole } from "./session";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  iconSrc?: string;
  /** Granular permission that unlocks this item for non-ADMIN/SUPER_ADMIN roles. Omit for items open to any authenticated user. */
  permission?: UserPermission;
};

export const NAV: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "⬡", iconSrc: "/icons/sidebar/dashboard.png" },
  { href: "/monitoring/network", label: "Monitoreo Red", icon: "◌", iconSrc: "/icons/sidebar/monitoreo-red.png" },
  { href: "/map", label: "Mapa GIS", icon: "◈", iconSrc: "/icons/sidebar/mapa-gis.png" },
  { href: "/topology", label: "Topología", icon: "◫", iconSrc: "/icons/sidebar/topologia.png" },
  { href: "/projects", label: "Proyectos", icon: "◧", iconSrc: "/icons/sidebar/proyectos.png" },
  { href: "/incidents", label: "Incidentes", icon: "⚠", iconSrc: "/icons/sidebar/incidentes.png" },
  { href: "/logbook", label: "Bitácora", icon: "≡", iconSrc: "/icons/sidebar/bitacora.png" },
];

export const ADMIN_NAV: SidebarNavItem[] = [
  { href: "/admin/cities", label: "Ciudades", icon: "○", iconSrc: "/icons/sidebar/ciudades.png", permission: "MANAGE_ORG" },
  { href: "/admin/branding", label: "Branding", icon: "◍", iconSrc: "/icons/sidebar/branding.png", permission: "MANAGE_ORG" },
  { href: "/admin/operations", label: "Operación", icon: "☰", iconSrc: "/icons/sidebar/operacion.png", permission: "MANAGE_ORG" },
  { href: "/admin/centers", label: "CMC", icon: "◎", iconSrc: "/icons/sidebar/cmc.png", permission: "MANAGE_ORG" },
  { href: "/admin/routes", label: "Rutas", icon: "⌥", iconSrc: "/icons/sidebar/rutas.png", permission: "MANAGE_ROUTES" },
  { href: "/admin/nodes", label: "Nodos", icon: "◉", iconSrc: "/icons/sidebar/nodos.png", permission: "MANAGE_NODES" },
  { href: "/admin/cameras", label: "Cámaras", icon: "⊙", iconSrc: "/icons/sidebar/camaras.png", permission: "MANAGE_CAMERAS" },
  { href: "/admin/users", label: "Usuarios", icon: "⊕", iconSrc: "/icons/sidebar/usuarios.png", permission: "MANAGE_USERS" },
];

/**
 * SUPER_ADMIN/ADMIN see every admin item (they bypass granular permissions
 * on the backend too — see PermissionsGuard). Every other role only sees the
 * items backed by a permission they actually hold, so a SUPERVISOR granted
 * e.g. MANAGE_CAMERAS can find that page without needing the exact URL.
 */
export function getVisibleAdminNav(role: UserRole, permissions: UserPermission[]): SidebarNavItem[] {
  if (!shouldRoleUseGranularPermissions(role)) return ADMIN_NAV;
  return ADMIN_NAV.filter((item) => !item.permission || permissions.includes(item.permission));
}
