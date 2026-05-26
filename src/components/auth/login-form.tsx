"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, error } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email, password);
      const adminRoles = ["SUPER_ADMIN", "ADMIN"];
      router.push(adminRoles.includes(user.role) ? "/admin" : "/");
    } catch {
      // error is set by AuthProvider
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    document.body.classList.add("login-bg");
    return () => document.body.classList.remove("login-bg");
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10">
        <Card className="w-full max-w-[580px] rounded-2xl ring-1 ring-foreground/10 shadow-2xl backdrop-blur-sm bg-white/70 dark:bg-black/50 animate-slide-up">
        <CardHeader className="text-center pt-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg overflow-hidden">
            <img src="/logo-Photoroom.png" alt="LMS" className="h-full w-full object-cover" />
          </div>
          <CardTitle className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
            Đăng nhập LMS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
            <div className="flex items-center justify-between text-sm flex-nowrap gap-4">
              <Link href="/register" className="font-medium text-primary hover:underline">
                Đăng ký tài khoản
              </Link>
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
