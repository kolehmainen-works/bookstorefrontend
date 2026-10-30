import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { apiFetch, loadSession, saveSession, setUnauthorizedHandler } from "./api";
import type { LoginResponse } from "./types";

interface AuthContextValue {
  session: LoginResponse | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (form: SignupForm) => Promise<void>;
  logout: () => void;
}

export interface SignupForm {
  username: string;
  email: string;
  password: string;
  passwordCheck: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(() => loadSession());

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    saveSession(response);
    setSession(response);
  }, []);

  // creates the account and signs the new user in
  const signup = useCallback(async (form: SignupForm) => {
    const response = await apiFetch<LoginResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(form),
    });
    saveSession(response);
    setSession(response);
  }, []);

  // an expired or rejected token signs the user out
  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!session) return;
    const msLeft = new Date(session.expiresAt).getTime() - Date.now();
    const timer = window.setTimeout(logout, Math.max(msLeft, 0));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const value = useMemo(
    () => ({
      session,
      isAdmin: session?.roles.includes("ROLE_ADMIN") ?? false,
      login,
      signup,
      logout,
    }),
    [session, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
