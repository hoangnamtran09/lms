"use client";

import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { API_BASE } from "@/lib/api-client";

interface User {
  id: string;
  supabaseId: string;
  fullName: string;
  role: string;
  classId?: string;
  email?: string;
  avatarUrl?: string;
}

interface SupabaseSessionUser {
  id: string;
  email?: string | null;
  app_metadata?: { role?: string };
  user_metadata?: { fullName?: string };
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

function buildFallbackUser(sessionUser: SupabaseSessionUser): User {
  return {
    id: sessionUser.id,
    supabaseId: sessionUser.id,
    fullName: sessionUser.user_metadata?.fullName || sessionUser.email || "Người dùng",
    role: sessionUser.app_metadata?.role || "STUDENT",
    email: sessionUser.email || undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch local user profile from backend after Supabase session is established
  const fetchLocalUser = useCallback(async (sessionUser?: SupabaseSessionUser, token?: string) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const u = (await res.json()) as User;
      setUser(u);
      if (token) setTokenCookie(token);
      return u;
    } catch {
      if (sessionUser) {
        const fallbackUser = buildFallbackUser(sessionUser);
        setUser(fallbackUser);
        if (token) setTokenCookie(token);
        return fallbackUser;
      }
      setUser(null);
      setTokenCookie(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // Restore session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchLocalUser(session.user as SupabaseSessionUser, session.access_token).finally(() => setLoading(false));
      } else {
        setTokenCookie(null);
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchLocalUser(session.user as SupabaseSessionUser, session.access_token);
      } else {
        setUser(null);
        setTokenCookie(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchLocalUser]);

  const login = async (email: string, password: string): Promise<User> => {
    setError(null);
    try {
      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15000,
        "Kết nối đến máy chủ xác thực bị timeout. Vui lòng thử lại."
      );
      if (signInError) {
        setError(signInError.message);
        throw signInError;
      }
      const sessionUser = data.user as SupabaseSessionUser;
      const token = data.session?.access_token;
      // Dùng fallback user ngay lập tức để UI hiển thị nhanh
      const fallbackUser = buildFallbackUser(sessionUser);
      setUser(fallbackUser);
      if (token) setTokenCookie(token);
      // Đợi backend trả về role chính xác trước khi redirect
      const verifiedUser = await fetchLocalUser(sessionUser, token);
      return verifiedUser || fallbackUser;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Đã có lỗi xảy ra";
      setError(message);
      throw err;
    }
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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
