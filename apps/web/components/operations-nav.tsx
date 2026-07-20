"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/admin/operations",
    label: "Backup",
    description: "Respaldos, restauraciones y actualizaciones offline.",
    iconSrc: "/icons/sidebar/respaldo.png",
  },
  {
    href: "/admin/operations/reports-monitoring",
    label: "Informe Monitoreo",
    description: "Disponibilidad, alertas y comportamiento operativo de red.",
    iconSrc: "/icons/sidebar/monitoreo-red.png",
  },
  {
    href: "/admin/operations/reports-infrastructure",
    label: "Inventario / Infraestructura",
    description: "Capacidad, distribución y composición física de la red.",
    iconSrc: "/icons/sidebar/topologia.png",
  },
  {
    href: "/admin/operations/reports-incidents",
    label: "Informe Incidentes",
    description: "Volumen, severidad, tiempos de resolución y tendencia.",
    iconSrc: "/icons/sidebar/incidentes.png",
  },
] as const;

export function OperationsNav() {
  const pathname = usePathname();

  return (
    <section className="rounded-ops border border-ops-border bg-ops-panel p-5 shadow-ops">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ops-muted">Submódulos de operación</p>
        <h2 className="mt-2 text-lg font-semibold text-ops-text">Centro documental y continuidad operativa</h2>
        <p className="mt-2 text-sm text-ops-muted">
          Desde aquí navegas entre respaldos operativos y los informes oficiales que quedan históricos en PDF y CSV.
        </p>
      </div>
      <div className="grid gap-3 xl:grid-cols-4">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-ops border p-4 transition-colors ${
                active
                  ? "border-ops-blue/40 bg-ops-blue/10 shadow-ops-glow-blue"
                  : "border-ops-border bg-ops-surface hover:border-ops-blue/30 hover:bg-ops-surface/70"
              }`}
            >
              <div className="flex items-start gap-3">
                <img src={item.iconSrc} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ops-text">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-ops-muted">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
