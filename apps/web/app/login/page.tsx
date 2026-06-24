"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth-provider";
import { getApiUrl } from "../../lib/api";
import { SessionUser } from "../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? "Credenciales inválidas");
      }
      const data = await res.json() as { accessToken: string; user: SessionUser };
      login({ accessToken: data.accessToken, user: data.user });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ops-bg px-4">
      <div className="w-full max-w-md">
        {/* Logo area */}
        <div className="mb-8 text-center">
          <p className="font-mono text-2xl font-bold tracking-wide text-ops-text">
            SIGES<span className="text-ops-cyan">-CCTV</span>
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.32em] text-ops-muted">
            Sistema Integral de Gestión Operacional
          </p>
        </div>

        {/* Card */}
        <div className="rounded-ops-lg border border-ops-border bg-ops-panel p-8 shadow-ops">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-ops-cyan">
            Acceso al sistema
          </h2>
          <p className="mb-6 text-xs text-ops-muted">Ingresa con tu cuenta institucional</p>

          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ops-muted">Correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@entidad.gov.co"
                className="w-full rounded-ops border border-ops-border bg-ops-surface px-3.5 py-2.5 text-sm text-ops-text placeholder-ops-dim outline-none transition focus:border-ops-cyan"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ops-muted">Contraseña</span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-ops border border-ops-border bg-ops-surface px-3.5 py-2.5 pr-20 text-sm text-ops-text placeholder-ops-dim outline-none transition focus:border-ops-cyan"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute inset-y-1.5 right-1.5 rounded px-2.5 text-[11px] text-ops-muted transition hover:text-ops-text"
                >
                  {show ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-ops border border-ops-rose/30 bg-ops-rose/10 px-3.5 py-2.5 text-xs text-ops-rose">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-ops bg-ops-cyan px-4 py-2.5 text-sm font-semibold text-ops-bg transition hover:bg-ops-cyan-dim disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verificando…" : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[10px] text-ops-dim">
          SIGES-CCTV · Uso restringido · Todos los derechos reservados
        </p>
      </div>
    </main>
  );
}
