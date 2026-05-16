"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";

interface User {
  id: string;
  supabaseId: string;
  fullName: string;
  role: string;
  classId?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
  } else {
    document.cookie = "token=; path=/; max-age=0";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch local user profile from backend after Supabase session is established
  const fetchLocalUser = useCallback(async (token?: string) => {
    try {
      const u = await api<{ id: string; supabaseId: string; fullName: string; role: string; classId?: string }>("/api/auth/me");
      setUser(u);
      if (token) setTokenCookie(token);
    } catch {
      setUser(null);
      setTokenCookie(null);
    }
  }, []);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchLocalUser(session.access_token).finally(() => setLoading(false));
      } else {
        setTokenCookie(null);
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchLocalUser(session.access_token);
      } else {
        setUser(null);
        setTokenCookie(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchLocalUser]);

  const login = async (email: string, password: string): Promise<User> => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
    const me = await api<{ id: string; supabaseId: string; fullName: string; role: string; classId?: string }>("/api/auth/me");
    setUser(me);
    return me;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
