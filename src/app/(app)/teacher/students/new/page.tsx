"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClassItem {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewStudentPage() {
  const router = useRouter();

  // Form state
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");

  // Data
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api<ClassItem[]>("/api/classes")
      .then((d) => setClasses(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password || !selectedClassId) {
      setError("Vui lòng điền đầy đủ các trường bắt buộc (*)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          password,
          email: email.trim(),
          classId: selectedClassId,
          role: "STUDENT",
          dob: dob || undefined,
          gender: gender || undefined,
        }),
      });
      setSuccess(true);
      setTimeout(() => router.push("/teacher/students"), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo học sinh thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const requiredFields = [fullName, username, password, selectedClassId];
  const totalRequired = requiredFields.length;
  const filledRequired = requiredFields.filter((v) => v.trim()).length;

  return (
    <div className="animate-fade-in relative min-h-[calc(100vh-3.5rem)]">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[5%] w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Success toast */}
      {success && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 font-semibold shadow-lg animate-in fade-in zoom-in">
          <span className="flex items-center gap-2">
            <MaterialIcon name="check_circle" filled className="text-emerald-500" />
            Đã tạo học sinh thành công! Đang chuyển hướng...
          </span>
        </div>
      )}

      <div className="max-w-[900px] mx-auto pb-32 px-4 lg:px-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 pt-6">
          <div>
            <Link
              href="/teacher/students"
              className="inline-flex items-center justify-center size-10 rounded-full hover:bg-gray-100 transition-colors text-blue-600 active:scale-95 mb-3"
            >
              <MaterialIcon name="arrow_back" className="text-2xl" />
            </Link>
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block mb-2">
              Quy trình 3 bước
            </span>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">
              Thông tin học sinh mới
            </h2>
            <p className="text-base text-gray-500 mt-1">
              Hoàn thành các thông tin dưới đây để thiết lập tài khoản học tập cho học sinh.
            </p>
          </div>
          <div className="size-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
            <MaterialIcon name="person_add" className="text-[48px]" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-600 flex items-center gap-2">
            <MaterialIcon name="error" filled className="text-red-500 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal Information */}
          <section className="bg-white/80 backdrop-blur-md border border-gray-200/30 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <MaterialIcon name="badge" className="text-xl" />
              </div>
              <h4 className="text-lg font-semibold text-blue-600">
                1. Thông tin cá nhân
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Họ và tên <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
                  className="h-12 rounded-xl bg-white/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Ngày sinh <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="h-12 rounded-xl bg-white/50 appearance-none pr-10"
                  />
                  <MaterialIcon
                    name="calendar_today"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Giới tính <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-3 h-12">
                  {[
                    { value: "male", label: "Nam" },
                    { value: "female", label: "Nữ" },
                    { value: "other", label: "Khác" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 cursor-pointer transition-all ${
                        gender === opt.value
                          ? "bg-blue-50 border-blue-500 text-blue-700"
                          : "border-gray-200 hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={opt.value}
                        checked={gender === opt.value}
                        onChange={(e) => setGender(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-base font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Account Details */}
          <section className="bg-white/80 backdrop-blur-md border border-gray-200/30 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600">
                <MaterialIcon name="account_circle" className="text-xl" />
              </div>
              <h4 className="text-lg font-semibold text-pink-600">
                2. Chi tiết tài khoản
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Email <span className="text-gray-400 font-normal">(Tuỳ chọn)</span>
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@school.edu.vn"
                  className="h-12 rounded-xl bg-white/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Tên đăng nhập <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="student.name.2024"
                    className="h-12 rounded-xl bg-white/50 pr-10"
                  />
                  <MaterialIcon
                    name="alternate_email"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 rounded-xl bg-white/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Academic Info */}
          <section className="bg-white/80 backdrop-blur-md border border-gray-200/30 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="size-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <MaterialIcon name="school" className="text-xl" />
              </div>
              <h4 className="text-lg font-semibold text-emerald-600">
                3. Thông tin học thuật
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Chọn lớp học <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v || "")}>
                  <SelectTrigger className="h-12 rounded-xl bg-white/50">
                    <SelectValue placeholder="Chọn lớp học">
                      {(value: string) => {
                        const cls = classes.find((c) => c.id === value);
                        return cls
                          ? `${cls.name}${cls.gradeLevelName ? ` (${cls.gradeLevelName})` : ""}`
                          : "";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.gradeLevelName ? ` (${c.gradeLevelName})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600 ml-1">
                  Mã học sinh <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    value={username}
                    disabled
                    className="h-12 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed pr-10"
                    placeholder="Tự động từ tên đăng nhập"
                  />
                  <MaterialIcon
                    name="tag"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1 italic">
                  * Mã học sinh được tạo tự động từ tên đăng nhập để định danh duy nhất trên hệ thống.
                </p>
              </div>
            </div>
          </section>
        </form>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-[260px] right-0 h-20 bg-white/90 backdrop-blur-md border-t border-gray-200 flex items-center justify-between px-8 z-50">
        <Link
          href="/teacher/students"
          className="px-6 py-3 rounded-xl text-gray-600 font-semibold hover:bg-gray-100 transition-all active:scale-95 flex items-center gap-2"
        >
          <MaterialIcon name="close" />
          Hủy
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 hidden sm:block">
            Đã nhập {filledRequired}/{totalRequired} trường bắt buộc
          </span>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
          >
            <MaterialIcon name="person_add" filled />
            {submitting ? "Đang tạo..." : "Tạo học sinh"}
          </Button>
        </div>
      </div>
    </div>
  );
}
