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
