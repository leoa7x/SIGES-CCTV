const LIFECYCLE_STATE_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  ARCHIVED: "Archivado",
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Superadministrador",
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  OPERATOR: "Operador",
  TECHNICIAN: "Técnico",
  VIEWER: "Consulta",
};

export function formatLifecycleState(state: string) {
  return LIFECYCLE_STATE_LABELS[state] ?? state;
}

export function formatRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export function formatLoginTitle(_entityName?: string | null) {
  return "Acceso operativo";
}

export function formatLoginSupportText(entityName?: string | null) {
  if (entityName) {
    return `Ingresa con tu cuenta autorizada para continuar en ${entityName}.`;
  }

  return "Ingresa con tu cuenta autorizada para continuar.";
}

export function toUserFacingError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const RELATIVE_TIME_UNITS: Array<{ limitMs: number; divisorMs: number; unit: string }> = [
  { limitMs: 60_000, divisorMs: 1_000, unit: "segundo" },
  { limitMs: 3_600_000, divisorMs: 60_000, unit: "minuto" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, unit: "hora" },
  { limitMs: Infinity, divisorMs: 86_400_000, unit: "día" },
];

export function formatRelativeTime(iso: string | null | undefined, fallback = "nunca"): string {
  if (!iso) return fallback;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return fallback;

  const diffMs = Date.now() - timestamp;
  if (diffMs < 5_000) return "hace instantes";

  const { divisorMs, unit } = RELATIVE_TIME_UNITS.find((entry) => diffMs < entry.limitMs) ?? RELATIVE_TIME_UNITS[RELATIVE_TIME_UNITS.length - 1];
  const amount = Math.floor(diffMs / divisorMs);
  return `hace ${amount} ${unit}${amount === 1 ? "" : "s"}`;
}
