"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { useAuth } from "./auth-provider";

const NAV = [
  { href: "/dashboard",  label: "Dashboard",   icon: "⬡" },
  { href: "/map",        label: "Mapa GIS",     icon: "◈" },
  { href: "/topology",   label: "Topología",    icon: "◫" },
  { href: "/incidents",  label: "Incidentes",   icon: "⚠" },
  { href: "/logbook",    label: "Bitácora",     icon: "≡" },
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

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ops-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ops-bg text-ops-text">
      {/* Sidebar */}
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-ops-border bg-ops-panel">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-ops-border px-5 py-4">
          <SigesLogo />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-ops-silver/60">Sistema Integral</p>
            <p className="mt-0.5 font-display text-sm font-bold tracking-wide text-ops-text">
              SIGES<span className="text-ops-blue">-CCTV</span>
            </p>
          </div>
        </div>

        {/* User */}
        <div className="border-b border-ops-border px-5 py-4">
          <p className="text-[9px] uppercase tracking-widest text-ops-muted">Operador</p>
          <p className="mt-0.5 truncate text-sm font-medium text-ops-text">{user.name ?? user.email}</p>
          <span className="mt-1 inline-block rounded-full border border-ops-blue/30 bg-ops-blue/10 px-2 py-0.5 font-mono text-[9px] text-ops-blue">
            {user.role}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-ops px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-ops-blue/10 text-ops-blue shadow-ops-glow-blue"
                    : "text-ops-muted hover:bg-ops-surface hover:text-ops-text"
                }`}
              >
                <span className="font-mono text-base leading-none">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-ops-border px-3 py-4">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-muted transition hover:border-ops-rose/40 hover:text-ops-rose"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

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
