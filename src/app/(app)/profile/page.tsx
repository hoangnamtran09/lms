"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Shield, Save, Loader2, CheckCircle2 } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (user) setFullName(user.fullName); }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    if (!fullName.trim()) {
      setSaveError("Họ tên không được để trống");
      return;
    }

    setSaving(true);
    try {
      await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ fullName: fullName.trim() }),
      });
      setSaveSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cập nhật thất bại";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });
      if (signInError) {
        setPasswordError("Mật khẩu hiện tại không đúng");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đổi mật khẩu thất bại";
      setPasswordError(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-64 rounded-xl" />
      </div>
    );
  }

  const initials = user.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Trang cá nhân</h1>

      {/* Profile info */}
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">Thông tin tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar size="lg">
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-gray-900">{user.fullName}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="size-4 text-gray-400" />
              <span className="text-gray-700">{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="size-4 text-gray-400" />
              <span className="text-gray-700">
                {user.role === "STUDENT" ? "Học sinh" :
                 user.role === "TEACHER" ? "Giáo viên" :
                 user.role === "PARENT" ? "Phụ huynh" :
                 user.role === "ADMIN" ? "Quản trị viên" :
                 user.role === "SUPER_ADMIN" ? "Quản trị viên cấp cao" : user.role}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit profile */}
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">Chỉnh sửa thông tin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Họ và tên</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên"
                required
              />
            </div>
            {saveSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Cập nhật thành công
              </p>
            )}
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
              Lưu thay đổi
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-gray-900">Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 6 ký tự"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                required
              />
            </div>
            {passwordSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="size-4" /> Đổi mật khẩu thành công
              </p>
            )}
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Đổi mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
