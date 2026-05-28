"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      if (adminRoles.includes(user.role)) {
        router.push("/admin");
      } else if (user.role === "TEACHER") {
        router.push("/teacher");
      } else {
        router.push("/");
      }
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
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8">
      <div className="relative z-10 w-full max-w-[920px] animate-slide-up">
        <Card className="overflow-hidden rounded-[28px] border border-white/40 bg-white/72 shadow-2xl backdrop-blur-md dark:bg-black/55">
          <div className="grid md:grid-cols-[0.95fr_1.05fr]">
            <div className="flex flex-col justify-between gap-8 bg-gradient-to-br from-white/70 via-white/55 to-primary/10 px-6 py-8 md:px-8">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary/80">
                    Nền học tập thông minh
                  </p>
                  <h1 className="text-3xl font-black leading-tight text-gray-900 dark:text-gray-50">
                    Đăng nhập để tiếp tục bài học, bài tập và tiến độ của bạn.
                  </h1>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-gray-700 dark:text-gray-200">
                <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-black/5">
                  Xem tiến độ học tập và nhiệm vụ mới ngay khi vào hệ thống
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-black/5">
                  Truy cập bài học, bài tập và thông báo ở một chỗ
                </div>
              </div>
            </div>

            <div className="bg-white/72 px-6 py-8 md:px-8">
              <CardHeader className="px-0 pt-0 text-center md:text-left">
                <CardTitle className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                  Đăng nhập LMS
                </CardTitle>
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                  Nhập tài khoản của bạn để vào hệ thống học tập.
                </p>
              </CardHeader>
              <CardContent className="px-0 pb-0 pt-6">
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
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                  </Button>
                  <div className="flex items-center justify-between gap-4 text-sm flex-nowrap">
                    <Link href="/register" className="font-medium text-primary hover:underline">
                      Đăng ký tài khoản
                    </Link>
                    <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                      Quên mật khẩu?
                    </Link>
                  </div>
                </form>
              </CardContent>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
