"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaterialIcon } from "@/components/ui/material-icon";

interface StudentRow {
  id: string;
  fullName: string;
  classId?: string;
  className?: string;
}

interface ClassItem {
  id: string;
  name: string;
}

export default function NewParentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    gender: "",
    address: "",
    relationship: "",
    username: "",
    password: "",
  });

  // Student search & selection
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<StudentRow[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api<StudentRow[]>("/api/users?role=STUDENT"),
      api<ClassItem[]>("/api/classes"),
    ]).then(([s, c]) => {
      setStudents(Array.isArray(s) ? s : []);
      setClasses(Array.isArray(c) ? c : []);
    }).catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredStudents = students.filter((s) => {
    if (selectedStudents.find((sel) => sel.id === s.id)) return false;
    if (!studentSearch.trim()) return false;
    const q = studentSearch.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  const getClassName = (classId?: string) => {
    if (!classId) return "";
    const c = classes.find((c) => c.id === classId);
    return c?.name || "";
  };

  const addStudent = (s: StudentRow) => {
    setSelectedStudents((prev) => [...prev, s]);
    setStudentSearch("");
    setShowDropdown(false);
  };

  const removeStudent = (id: string) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // Create parent user
      const parent = await api<{ id: string }>("/api/users", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username || form.phone || form.fullName.toLowerCase().replace(/\s/g, ""),
          password: form.password || "Parent@123",
          phone: form.phone,
          role: "PARENT",
        }),
      });

      // Create links with selected students
      if (selectedStudents.length > 0) {
        await Promise.all(
          selectedStudents.map((s) =>
            api("/api/admin/parent-links", {
              method: "POST",
              body: JSON.stringify({ parentId: parent.id, childId: s.id }),
            })
          )
        );
      }

      router.push("/admin/parents");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo thất bại");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 animate-fade-in">
      {/* Breadcrumbs + Header */}
      <div className="mb-8">
        <Link href="/admin/parents" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="size-4" />
          Quay lại Quản lý phụ huynh
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <MaterialIcon name="person_add" className="text-2xl" />
          </div>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">Thêm mới phụ huynh</h2>
        </div>
        <p className="text-sm text-gray-500 mt-2">Tạo tài khoản phụ huynh và kết nối với học sinh trong hệ thống.</p>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 lg:p-8 flex flex-col gap-10">
            {/* Section 1: Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <h3 className="text-lg font-semibold text-gray-900">Thông tin cá nhân</h3>
                <p className="text-sm text-gray-500 mt-2">Dùng để định danh và liên hệ trực tiếp với phụ huynh.</p>
              </div>
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-sm text-gray-600">Họ và tên <span className="text-red-500">*</span></label>
                  <Input
                    className="mt-1.5 bg-gray-50 border-gray-200 rounded-lg"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold text-sm text-gray-600">Số điện thoại <span className="text-red-500">*</span></label>
                  <div className="relative mt-1.5">
                    <MaterialIcon name="call" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                    <Input
                      className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
                      placeholder="09xx xxx xxx"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-sm text-gray-600">Giới tính</label>
                  <select
                    className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="font-semibold text-sm text-gray-600">Địa chỉ liên hệ</label>
                  <textarea
                    className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                    placeholder="Nhập địa chỉ thường trú hoặc tạm trú"
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Section 2: Account & Connection */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4">
                <h3 className="text-lg font-semibold text-gray-900">Tài khoản & Kết nối</h3>
                <p className="text-sm text-gray-500 mt-2">Thiết lập tài khoản đăng nhập và liên kết với học sinh.</p>
              </div>
              <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-sm text-gray-600">Tên đăng nhập <span className="text-red-500">*</span></label>
                  <div className="relative mt-1.5">
                    <MaterialIcon name="person" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                    <Input
                      className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
                      placeholder="Nhập tên đăng nhập"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-sm text-gray-600">Mật khẩu <span className="text-red-500">*</span></label>
                  <div className="relative mt-1.5">
                    <MaterialIcon name="lock" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                    <Input
                      className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
                      type="password"
                      placeholder="Nhập mật khẩu"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-sm text-gray-600">Mối quan hệ <span className="text-red-500">*</span></label>
                  <select
                    className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                    value={form.relationship}
                    onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                  >
                    <option value="">Chọn mối quan hệ...</option>
                    <option value="cha">Cha</option>
                    <option value="me">Mẹ</option>
                    <option value="giamho">Người giám hộ</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-sm text-gray-600">Trạng thái tài khoản</label>
                  <div className="flex items-center gap-2 mt-1.5 h-[42px]">
                    <div className="w-10 h-5 bg-primary rounded-full relative shadow-inner">
                      <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Đang hoạt động</span>
                  </div>
                </div>

                {/* Kết nối học sinh — Stitch design */}
                <div className="sm:col-span-2">
                  <label className="font-semibold text-sm text-gray-600">Kết nối học sinh <span className="text-red-500">*</span></label>
                  <div className="relative mt-1.5" ref={searchRef}>
                    <MaterialIcon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl z-10" />
                    <input
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-11 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                      placeholder="Tìm kiếm tên hoặc mã học sinh..."
                      value={studentSearch}
                      onChange={(e) => { setStudentSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                    />

                    {/* Dropdown search results */}
                    {showDropdown && studentSearch.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-44 overflow-y-auto">
                        {filteredStudents.length === 0 ? (
                          <div className="p-3 text-sm text-gray-400 text-center">Không tìm thấy học sinh</div>
                        ) : (
                          filteredStudents.slice(0, 8).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between"
                              onClick={() => addStudent(s)}
                            >
                              <span className="text-sm font-medium text-gray-900">{s.fullName}</span>
                              {getClassName(s.classId) && (
                                <span className="text-xs text-gray-400">Lớp {getClassName(s.classId)}</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected student tags */}
                  {selectedStudents.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedStudents.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 bg-primary/5 text-primary px-3 py-1 rounded-full text-xs font-semibold border border-primary/20"
                        >
                          {s.fullName}
                          {getClassName(s.classId) && (
                            <span className="text-primary/50">- Lớp {getClassName(s.classId)}</span>
                          )}
                          <button type="button" onClick={() => removeStudent(s.id)} className="hover:text-red-500 transition-colors ml-0.5">
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="font-semibold text-sm text-gray-600">Ghi chú thêm</label>
                  <textarea
                    className="w-full mt-1.5 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                    placeholder="Nhập các lưu ý quan trọng về phụ huynh..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 lg:px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-4">
            <Link href="/admin/parents" className="px-6 py-2.5 rounded-lg font-semibold text-gray-500 hover:bg-gray-100 transition-colors">
              Hủy
            </Link>
            <Button type="submit" disabled={saving} className="rounded-lg shadow-md gap-2">
              <MaterialIcon name="person_add" className="text-xl" />
              {saving ? "Đang tạo..." : "Thêm mới phụ huynh"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
