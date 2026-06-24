"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AuthState, clearAuth, loadAuth, saveAuth, SessionUser } from "../lib/session";

type AuthContextType = {
  user: SessionUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (state: AuthState) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setState(loadAuth());
    setIsLoading(false);
  }, []);

  function login(newState: AuthState) {
    saveAuth(newState);
    setState(newState);
  }

  function logout() {
    clearAuth();
    setState(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{
        user: state?.user ?? null,
        accessToken: state?.accessToken ?? null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
