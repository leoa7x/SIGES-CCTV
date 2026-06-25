import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial — Manual de Imagen Corporativa SIGES-CCTV
        "ops-bg":        "#061929",   // root background (más oscuro que Azul Marino)
        "ops-panel":     "#0A2540",   // Azul Marino Institucional — paneles
        "ops-surface":   "#0D2F55",   // superficies elevadas / hover
        "ops-border":    "#1A3A65",   // bordes
        "ops-blue":      "#1D4ED8",   // Azul Rey Tecnológico — acento primario
        "ops-blue-dim":  "#1742A8",   // Azul Rey hover / secundario
        "ops-silver":    "#94A3B8",   // Gris Plata Operativo
        "ops-amber":     "#f59e0b",   // advertencia (semántico)
        "ops-rose":      "#f43f5e",   // alerta crítica / offline
        "ops-emerald":   "#10b981",   // online / ok
        "ops-text":      "#e2e8f0",   // texto principal
        "ops-muted":     "#94A3B8",   // texto secundario (= Gris Plata)
        "ops-dim":       "#334155",   // texto deshabilitado
      },
      fontFamily: {
        display: ["var(--font-display)", "Arial", "Helvetica Neue", "sans-serif"],
        body: ["Arial", "Helvetica Neue", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "ops": "0.75rem",     // standard card radius
        "ops-lg": "1rem",     // panels
        "ops-xl": "1.25rem",  // modals
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "blink": "blink 1.2s step-start infinite",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      boxShadow: {
        "ops":           "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        "ops-glow-blue": "0 0 14px rgba(29,78,216,0.35)",
        "ops-glow-rose": "0 0 12px rgba(244,63,94,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
