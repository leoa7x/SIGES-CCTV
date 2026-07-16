export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  iconSrc?: string;
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
  { href: "/admin/cities", label: "Ciudades", icon: "○", iconSrc: "/icons/sidebar/ciudades.png" },
  { href: "/admin/branding", label: "Branding", icon: "◍", iconSrc: "/icons/sidebar/branding.png" },
  { href: "/admin/centers", label: "CMC", icon: "◎", iconSrc: "/icons/sidebar/cmc.png" },
  { href: "/admin/routes", label: "Rutas", icon: "⌥", iconSrc: "/icons/sidebar/rutas.png" },
  { href: "/admin/nodes", label: "Nodos", icon: "◉", iconSrc: "/icons/sidebar/nodos.png" },
  { href: "/admin/cameras", label: "Cámaras", icon: "⊙", iconSrc: "/icons/sidebar/camaras.png" },
  { href: "/admin/users", label: "Usuarios", icon: "⊕", iconSrc: "/icons/sidebar/usuarios.png" },
];
