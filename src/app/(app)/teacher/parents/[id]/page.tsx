"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Key, Eye, EyeOff, Mail, Phone, MapPin, Calendar, Clock, Shield } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MaterialIcon } from "@/components/ui/material-icon";

interface LinkRow {
  id: string;
  parentId: string;
  parentName: string;
  childId: string;
  childName: string;
  createdAt: string;
}

interface ParentProfile {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  createdAt: string;
}

interface ChildInfo {
  id: string;
  fullName: string;
  className?: string;
  classId?: string;
  gradeLevel?: number;
  studentCode?: string;
}

export default function ParentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Password reset
  const [pwDialog, setPwDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  useEffect(() => {
    Promise.all([
      api<ParentProfile[]>(`/api/users?role=PARENT`).then(list => list.find(u => u.id === id) || null),
      api<LinkRow[]>("/api/teacher/parent-links"),
      api<ChildInfo[]>("/api/users?role=STUDENT"),
    ])
      .then(([p, l, s]) => {
        setProfile(p);
        setLinks(l.filter(link => link.parentId === id));
        // Attach class info to linked children
        const linked = l.filter(link => link.parentId === id).map(link => {
          const student = s.find(st => st.id === link.childId);
          return student || { id: link.childId, fullName: link.childName };
        });
        setChildren(linked);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleResetPassword = async () => {
    if (!profile || newPassword.length < 6) return;
    setPwError(""); setPwSuccess(""); setResetting(true);
    try {
      await api(`/api/teacher/parents/${profile.id}/reset-password`, {
        method: "POST", body: JSON.stringify({ newPassword }),
      });
      setPwSuccess("Đổi mật khẩu thành công!");
      setTimeout(() => { setPwDialog(false); setNewPassword(""); setPwSuccess(""); }, 1500);
    } catch (err) { setPwError(err instanceof ApiError ? err.message : "Lỗi đổi mật khẩu"); }
    finally { setResetting(false); }
  };

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
        <Skeleton delay={0} className="h-6 w-48 mb-6" />
        <Skeleton delay={80} className="h-20 w-full rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton delay={160} className="h-80 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Skeleton delay={240} className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-20 text-center">
        <p className="text-gray-500 text-lg">Không tìm thấy phụ huynh</p>
        <Link href="/teacher/parents" className="text-primary hover:underline mt-2 inline-block">Quay lại</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/teacher/parents" className="hover:text-primary transition-colors">Quản lý phụ huynh</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Chi tiết hồ sơ</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-200">
            <MaterialIcon name="person" className="text-[32px]" />
          </div>
          <div>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">{profile.fullName}</h2>
            <p className="text-gray-500 text-sm">ID Phụ huynh: {profile.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => { setNewPassword(""); setPwError(""); setPwSuccess(""); setPwDialog(true); }}
            className="rounded-xl gap-2"><Key className="size-4" />Đổi mật khẩu</Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Personal Info Card */}
          <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
            <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <MaterialIcon name="badge" className="text-xl" />Thông tin cá nhân
            </h3>
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Họ và tên</p>
                <p className="text-base text-gray-900 font-semibold">{profile.fullName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Số điện thoại</p>
                <p className="text-base text-gray-900 font-semibold flex items-center gap-2">
                  <Phone className="size-3.5 text-gray-400" />{profile.phone || "Chưa cập nhật"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Email</p>
                <p className="text-base text-gray-900 font-semibold flex items-center gap-2">
                  <Mail className="size-3.5 text-gray-400" />{profile.email || "Chưa cập nhật"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Ngày tham gia</p>
                <p className="text-base text-gray-900 font-semibold flex items-center gap-2">
                  <Calendar className="size-3.5 text-gray-400" />
                  {new Date(profile.createdAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </section>

          {/* Children Card */}
          <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-pink-600 flex items-center gap-2">
                <MaterialIcon name="groups" className="text-xl" />Danh sách con em
              </h3>
            </div>
            {children.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa liên kết với học sinh nào</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {children.map(child => (
                  <div key={child.id} className="p-4 bg-gray-50 hover:bg-gray-100 transition-all rounded-2xl border border-gray-200 flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
                      {child.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-gray-900 truncate">{child.fullName}</p>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {child.className || `Lớp ${child.gradeLevel || "—"}`}
                        {child.studentCode && ` • Mã HS: ${child.studentCode}`}
                      </p>
                      <Link href={`/teacher/students/${child.id}`}
                        className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-2 transition-all hover:underline">
                        Xem hồ sơ học sinh <ArrowLeft className="size-3 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Account Status Card */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-6">Trạng thái tài khoản</h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <Shield className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Kết nối</p>
                    <p className="text-sm font-bold text-gray-900">Đang hoạt động</p>
                  </div>
                </div>
                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Truy cập cuối</p>
                  <p className="text-sm font-bold text-gray-900">Chưa có dữ liệu</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-full flex items-center justify-center">
                  <MaterialIcon name="family_restroom" className="text-xl" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Học sinh liên kết</p>
                  <p className="text-sm font-bold text-gray-900">{children.length} học sinh</p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">Liên hệ nhanh</h3>
            <div className="space-y-3">
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group">
                  <Mail className="size-4 text-gray-400 group-hover:text-blue-500" />
                  <span className="text-sm text-gray-700 group-hover:text-blue-700">{profile.email}</span>
                </a>
              )}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-emerald-50 transition-colors group">
                  <Phone className="size-4 text-gray-400 group-hover:text-emerald-500" />
                  <span className="text-sm text-gray-700 group-hover:text-emerald-700">{profile.phone}</span>
                </a>
              )}
              {!profile.email && !profile.phone && (
                <p className="text-sm text-gray-400 text-center py-4">Chưa có thông tin liên hệ</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={pwDialog} onOpenChange={setPwDialog}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl [&>button]:top-4 [&>button]:right-4">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-xl font-bold text-primary">Đổi mật khẩu</h3></div>
          <div className="p-6 space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              Đổi mật khẩu cho: <span className="font-bold">{profile.fullName}</span>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Mật khẩu mới</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" className="pr-10 rounded-xl" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-emerald-600 font-medium">{pwSuccess}</p>}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-3">
            <Button variant="outline" onClick={() => setPwDialog(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6} className="rounded-xl shadow-md">
              {resetting ? "Đang đổi..." : "Đổi mật khẩu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
