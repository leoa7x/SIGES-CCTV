export function tabClass(active: boolean) {
  return `rounded-ops border px-3 py-1.5 text-xs font-medium transition-colors ${
    active
      ? "border-ops-blue bg-ops-blue text-white shadow-ops-glow-blue"
      : "border-ops-border text-ops-muted hover:border-ops-blue/40 hover:text-ops-text"
  }`;
}
