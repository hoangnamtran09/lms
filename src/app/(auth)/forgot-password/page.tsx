"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, MailCheck } from "lucide-react";
import { api } from "@/lib/api-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Vui lòng nhập email");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi yêu cầu thất bại";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-sm rounded-xl ring-1 ring-foreground/10 text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <MailCheck className="size-6 text-blue-600" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Đã gửi email!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Vui lòng kiểm tra email <strong>{email}</strong> và làm theo hướng dẫn
              để đặt lại mật khẩu.
            </p>
            <Link href="/login">
              <Button className="w-full">Quay lại đăng nhập</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm rounded-xl ring-1 ring-foreground/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <GraduationCap className="size-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold text-gray-900">
            Quên mật khẩu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email đã đăng ký"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
            <p className="text-center text-sm text-gray-500">
              <Link href="/login" className="font-medium text-primary hover:underline">
                Quay lại đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
