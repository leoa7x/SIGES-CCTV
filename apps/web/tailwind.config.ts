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
        // Dark ops center design system
        "ops-bg":      "#080d14",   // darkest — main background
        "ops-panel":   "#0e1724",   // card backgrounds
        "ops-surface": "#141f2e",   // lighter panels / hover
        "ops-border":  "#1e2d42",   // borders
        "ops-cyan":    "#06b6d4",   // primary accent (cyan-500)
        "ops-cyan-dim":"#0891b2",   // secondary cyan (cyan-600)
        "ops-amber":   "#f59e0b",   // warning
        "ops-rose":    "#f43f5e",   // danger / offline
        "ops-emerald": "#10b981",   // online / ok
        "ops-text":    "#e2e8f0",   // primary text (slate-200)
        "ops-muted":   "#64748b",   // muted text (slate-500)
        "ops-dim":     "#334155",   // dimmed (slate-700)
      },
      fontFamily: {
        display: ["var(--font-display)", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
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
        "ops": "0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)",
        "ops-glow-cyan": "0 0 12px rgba(6,182,212,0.25)",
        "ops-glow-rose": "0 0 12px rgba(244,63,94,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
