export const AUTH_STORAGE_KEY = "siges_auth";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "SUPERVISOR" | "OPERATOR" | "TECHNICIAN" | "VIEWER";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

export type AuthState = {
  accessToken: string;
  user: SessionUser;
};

export function loadAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

export function saveAuth(state: AuthState) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

export function clearAuth() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
