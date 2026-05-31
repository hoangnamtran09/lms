"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 md:p-8 bg-gray-50">
      {/* Floating background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-200 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-48 w-80 h-80 bg-emerald-200 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 w-64 h-64 bg-pink-200 rounded-full blur-3xl" />
      </div>

      {/* Auth Container */}
      <main className="w-full max-w-5xl flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden min-h-[600px]">
        {/* Left: Hero Section */}
        <section className="relative w-full md:w-1/2 min-h-[280px] md:min-h-full overflow-hidden">
          {/* Background image */}
          <Image
            src="/screen.png"
            alt="LMS Learning Illustration"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-primary/85 to-emerald-700/75 flex flex-col justify-end p-8 md:p-10 text-white">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <MaterialIcon name="school" filled className="text-2xl text-white" />
                </div>
                <span className="text-lg font-bold text-white/90">LMS</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold mb-4 leading-tight">
                NỀN HỌC TẬP THÔNG MINH
              </h1>
              <p className="text-base mb-6 opacity-90 leading-relaxed">
                Đăng nhập để tiếp tục bài học, bài tập và tiến độ của bạn.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <MaterialIcon name="check_circle" className="text-xl mt-0.5 shrink-0" />
                  <span className="text-sm">Xem tiến độ học tập và nhiệm vụ mới ngay khi vào hệ thống</span>
                </li>
                <li className="flex items-start gap-3">
                  <MaterialIcon name="check_circle" className="text-xl mt-0.5 shrink-0" />
                  <span className="text-sm">Truy cập bài học, bài tập và thông báo ở một chỗ</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Right: Login Form */}
        <section className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <header className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Đăng nhập</h2>
              <p className="text-sm text-gray-500">Vui lòng nhập thông tin để truy cập khóa học.</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="email">
                  Email hoặc Tên đăng nhập
                </label>
                <div className="relative">
                  <MaterialIcon name="mail" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    id="email"
                    placeholder="Nhập email hoặc tên đăng nhập"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="relative">
                  <MaterialIcon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                  <input
                    className="w-full pl-10 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} className="text-xl" />
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                    type="checkbox"
                  />
                  <span className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">
                    Ghi nhớ đăng nhập
                  </span>
                </label>
                <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Quên mật khẩu?
                </Link>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full py-3.5 rounded-xl text-base font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                disabled={submitting}
              >
                {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>

              {/* Divider */}
              <div className="relative py-3 flex items-center">
                <div className="flex-grow border-t border-gray-200" />
                <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                  Hoặc đăng nhập với
                </span>
                <div className="flex-grow border-t border-gray-200" />
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <MaterialIcon name="mail" className="text-xl text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Google</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <MaterialIcon name="mail" className="text-xl text-gray-500" />
                  <span className="text-sm font-medium text-gray-600">Microsoft</span>
                </button>
              </div>
            </form>

            <footer className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Chưa có tài khoản?{" "}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Liên hệ quản trị viên
                </Link>
              </p>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
