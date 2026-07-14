"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "./auth-provider";

const SIDEBAR_PINNED_KEY = "siges-sidebar-pinned";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",  icon: "⬡" },
  { href: "/monitoring/network", label: "Monitoreo Red", icon: "◌" },
  { href: "/map",        label: "Mapa GIS",    icon: "◈" },
  { href: "/topology",   label: "Topología",   icon: "◫" },
  { href: "/projects",   label: "Proyectos",   icon: "◧" },
  { href: "/incidents",  label: "Incidentes",  icon: "⚠" },
  { href: "/logbook",    label: "Bitácora",    icon: "≡" },
];

const ADMIN_NAV = [
  { href: "/admin/cities",   label: "Ciudades",  icon: "○" },
  { href: "/admin/centers",  label: "CMC",       icon: "◎" },
  { href: "/admin/routes",   label: "Rutas",     icon: "⌥" },
  { href: "/admin/nodes",    label: "Nodos",     icon: "◉" },
  { href: "/admin/cameras",  label: "Cámaras",   icon: "⊙" },
  { href: "/admin/users",    label: "Usuarios",  icon: "⊕" },
];

function SigesLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="SIGES-CCTV">
      {/* Escudo */}
      <path
        d="M18 2L4 8v10c0 8.28 5.92 16.02 14 18 8.08-1.98 14-9.72 14-18V8L18 2z"
        fill="#0A2540"
        stroke="#1D4ED8"
        strokeWidth="1.5"
      />
      {/* Lente exterior */}
      <circle cx="18" cy="18" r="7" fill="#0D2F55" stroke="#1D4ED8" strokeWidth="1.2" />
      {/* Lente interior */}
      <circle cx="18" cy="18" r="3.5" fill="#1D4ED8" />
      {/* Reflejo */}
      <circle cx="16.5" cy="16.5" r="1" fill="#94A3B8" opacity="0.6" />
    </svg>
  );
}

type OpsShellProps = {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
};

export function OpsShell({ children, title, eyebrow }: OpsShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  useEffect(() => {
    setPinned(window.localStorage.getItem(SIDEBAR_PINNED_KEY) === "1");
  }, []);

  function togglePinned() {
    setPinned((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_PINNED_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ops-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
      </div>
    );
  }

  const expanded = pinned || hovering || focused;

  return (
    <div className="flex min-h-screen bg-ops-bg text-ops-text">
      {/* Sidebar: icon rail, expands on hover, keyboard focus, or when pinned */}
      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        className={`z-40 flex h-screen flex-col overflow-hidden border-r border-ops-border bg-ops-panel transition-[width,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
          pinned ? "relative flex-shrink-0" : "fixed left-0 top-0"
        } ${expanded ? "w-64" : "w-16"} ${!pinned && expanded ? "shadow-2xl" : ""}`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 border-b border-ops-border px-5 py-4 ${expanded ? "" : "justify-center px-0"}`}>
          <SigesLogo />
          {expanded && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.3em] text-ops-silver/60">Sistema Integral</p>
              <p className="mt-0.5 whitespace-nowrap font-display text-sm font-bold tracking-wide text-ops-text">
                SIGES<span className="text-ops-blue">-CCTV</span>
              </p>
            </div>
          )}
          {expanded && (
            <button
              type="button"
              onClick={togglePinned}
              title={pinned ? "Liberar menú" : "Fijar menú"}
              className="flex-shrink-0 rounded-ops border border-ops-border px-1.5 py-1 font-mono text-xs text-ops-muted hover:border-ops-blue/40 hover:text-ops-text"
            >
              {pinned ? "⇤" : "⇥"}
            </button>
          )}
        </div>

        {/* User */}
        <div className={`border-b border-ops-border py-4 ${expanded ? "px-5" : "px-2 text-center"}`} title={expanded ? undefined : (user.name ?? user.email)}>
          {expanded ? (
            <>
              <p className="text-[9px] uppercase tracking-widest text-ops-muted">Operador</p>
              <p className="mt-0.5 truncate text-sm font-medium text-ops-text">{user.name ?? user.email}</p>
              <span className="mt-1 inline-block rounded-full border border-ops-blue/30 bg-ops-blue/10 px-2 py-0.5 font-mono text-[9px] text-ops-blue">
                {user.role}
              </span>
            </>
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ops-blue/30 bg-ops-blue/10 font-mono text-xs text-ops-blue">
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={expanded ? undefined : item.label}
                className={`flex items-center gap-3 rounded-ops px-3 py-2.5 text-sm font-medium transition-colors ${!expanded ? "justify-center px-0" : ""} ${
                  isActive
                    ? "bg-ops-blue/10 text-ops-blue shadow-ops-glow-blue"
                    : "text-ops-muted hover:bg-ops-surface hover:text-ops-text"
                }`}
              >
                <span className="font-mono text-base leading-none">{item.icon}</span>
                {expanded && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}

          {(user.role === "SUPER_ADMIN" || user.role === "ADMIN") && (
            <>
              {expanded ? (
                <p className="px-3 pb-1 pt-4 text-[9px] font-bold uppercase tracking-widest text-ops-dim">
                  Administración
                </p>
              ) : (
                <div className="mx-2 my-3 border-t border-ops-border" />
              )}
              {ADMIN_NAV.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={expanded ? undefined : item.label}
                    className={`flex items-center gap-3 rounded-ops px-3 py-2.5 text-sm font-medium transition-colors ${!expanded ? "justify-center px-0" : ""} ${
                      isActive
                        ? "bg-ops-blue/10 text-ops-blue shadow-ops-glow-blue"
                        : "text-ops-muted hover:bg-ops-surface hover:text-ops-text"
                    }`}
                  >
                    <span className="font-mono text-base leading-none">{item.icon}</span>
                    {expanded && <span className="whitespace-nowrap">{item.label}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className={`border-t border-ops-border py-4 ${expanded ? "px-3" : "px-2"}`}>
          <button
            type="button"
            onClick={logout}
            title={expanded ? undefined : "Cerrar sesión"}
            className="flex w-full items-center justify-center gap-2 rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-muted transition-colors hover:border-ops-rose/40 hover:text-ops-rose"
          >
            {expanded ? "Cerrar sesión" : "⏻"}
          </button>
        </div>
      </aside>

      {/* Spacer so fixed, unpinned rail doesn't sit on top of content */}
      {!pinned && <div className="w-16 flex-shrink-0" />}

      {/* Main */}
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        {(eyebrow || title) && (
          <header className="border-b border-ops-border bg-ops-panel px-6 py-4">
            {eyebrow && (
              <p className="text-[9px] font-bold uppercase tracking-[0.36em] text-ops-blue/70">{eyebrow}</p>
            )}
            {title && (
              <h1 className="mt-0.5 text-lg font-semibold text-ops-text">{title}</h1>
            )}
          </header>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
