"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface ClassItem {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName?: string;
  teacherId: string;
  teacherName?: string;
  sortOrder: number;
}

interface GradeLevel {
  id: string;
  name: string;
  level: number;
}

interface Teacher {
  id: string;
  fullName: string;
}

type Tab = "classes" | "grade-levels";

export default function AdminClassesPage() {
  const [tab, setTab] = useState<Tab>("classes");

  // ---- Classes ----
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: "", gradeLevelId: "", teacherId: "", sortOrder: "" });

  // ---- Grade Levels ----
  const [glDialogOpen, setGlDialogOpen] = useState(false);
  const [glSaving, setGlSaving] = useState(false);
  const [glError, setGlError] = useState("");
  const [editingGl, setEditingGl] = useState<GradeLevel | null>(null);
  const [glForm, setGlForm] = useState({ name: "", level: "" });

  const fetchData = () => {
    Promise.all([
      api<ClassItem[]>("/api/classes"),
      api<GradeLevel[]>("/api/grade-levels"),
      api<Teacher[]>("/api/users?role=TEACHER"),
    ])
      .then(([cls, gl, t]) => {
        setClasses(cls || []);
        setGradeLevels(gl || []);
        setTeachers(t || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  // ---- Class handlers ----
  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", gradeLevelId: "", teacherId: "", sortOrder: "" });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (c: ClassItem) => {
    setEditing(c);
    setForm({
      name: c.name,
      gradeLevelId: c.gradeLevelId || "",
      teacherId: c.teacherId || "",
      sortOrder: String(c.sortOrder ?? ""),
    });
    setError("");
    setDialogOpen(true);
  };

  const handleSaveClass = async () => {
    if (!form.name.trim() || !form.gradeLevelId) {
      setError("Tên lớp và Khối lớp là bắt buộc");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        gradeLevelId: form.gradeLevelId,
        teacherId: form.teacherId || "",
        sortOrder: parseInt(form.sortOrder || "0"),
      };
      if (editing) {
        await api(`/api/classes/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/classes", { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editing ? "Cập nhật thất bại" : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Xoá lớp học này?")) return;
    try {
      await api(`/api/classes/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  // ---- Grade Level handlers ----
  const openAddGl = () => {
    setEditingGl(null);
    setGlForm({ name: "", level: "" });
    setGlError("");
    setGlDialogOpen(true);
  };

  const openEditGl = (gl: GradeLevel) => {
    setEditingGl(gl);
    setGlForm({ name: gl.name, level: String(gl.level) });
    setGlError("");
    setGlDialogOpen(true);
  };

  const handleSaveGl = async () => {
    if (!glForm.name.trim() || !glForm.level) {
      setGlError("Tên khối và Cấp độ là bắt buộc");
      return;
    }
    setGlSaving(true);
    setGlError("");
    try {
      const body = {
        name: glForm.name.trim(),
        level: parseInt(glForm.level),
      };
      if (editingGl) {
        await api(`/api/grade-levels/${editingGl.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/grade-levels", { method: "POST", body: JSON.stringify(body) });
      }
      setGlDialogOpen(false);
      setEditingGl(null);
      fetchData();
    } catch (err) {
      setGlError(err instanceof ApiError ? err.message : editingGl ? "Cập nhật thất bại" : "Tạo thất bại");
    } finally {
      setGlSaving(false);
    }
  };

  const handleDeleteGl = async (id: string) => {
    if (!confirm("Xoá khối lớp này? Các lớp thuộc khối sẽ bị ảnh hưởng.")) return;
    try {
      await api(`/api/grade-levels/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      {/* Tab switcher — Stitch pill style */}
      <div className="flex gap-2 mb-8 p-1 bg-gray-100 w-fit rounded-2xl">
        {([
          { key: "classes", label: "Lớp học", icon: "school" },
          { key: "grade-levels", label: "Khối lớp", icon: "layers" },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? "bg-white text-primary font-semibold shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <MaterialIcon name={icon} filled={tab === key} className="text-[20px]" />
            {label}
          </button>
        ))}
      </div>

      {/* === TAB: Lớp học === */}
      {tab === "classes" && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <button onClick={() => window.history.back()} className="flex items-center text-primary text-sm font-medium gap-1 mb-2 hover:underline">
                <MaterialIcon name="arrow_back" className="text-lg" />
                Quay lại
              </button>
              <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">Quản lí lớp học</h2>
              <p className="text-sm text-gray-500">Tạo và quản lí các lớp học theo khối học của nhà trường.</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setError(""); } }}>
              <DialogTrigger render={<Button onClick={openAdd} className="shadow-lg shadow-primary/20 rounded-xl"><MaterialIcon name="add" className="text-xl mr-1.5" />Thêm lớp học</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Sửa lớp học" : "Thêm lớp học"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Tên lớp</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: 10A1" />
                  </div>
                  <div>
                    <Label>Khối lớp</Label>
                    <Select value={form.gradeLevelId} onValueChange={(v) => setForm({ ...form, gradeLevelId: v ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="Chọn khối lớp" /></SelectTrigger>
                      <SelectContent>
                        {gradeLevels.map((gl) => (
                          <SelectItem key={gl.id} value={gl.id}>{gl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Giáo viên chủ nhiệm</Label>
                    <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v ?? "" })}>
                      <SelectTrigger><SelectValue placeholder="Chọn giáo viên (tuỳ chọn)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Chưa chọn --</SelectItem>
                        {teachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Thứ tự</Label>
                    <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} placeholder="Số thứ tự hiển thị" />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button onClick={handleSaveClass} disabled={saving} className="w-full">
                    {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Class Table — Stitch style */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            {loading ? (
              <div className="p-6"><Skeleton className="h-40 w-full" /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/80">
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Tên lớp</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Khối</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Giáo viên CN</TableHead>
                        <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                            Chưa có lớp học nào
                          </TableCell>
                        </TableRow>
                      ) : (
                        classes.map((c) => (
                          <TableRow key={c.id} className="group hover:bg-gray-50/70 transition-colors">
                            <TableCell className="py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                                  {c.name.slice(0, 4)}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                                {c.gradeLevelName || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="py-5">
                              {c.teacherName ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                                    {c.teacherName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </div>
                                  <span className="text-sm text-gray-700">{c.teacherName}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex items-center justify-end gap-1">
                                <Link href={`/admin/students?classId=${c.id}`} className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex" title="Xem học sinh">
                                  <MaterialIcon name="visibility" className="text-xl" />
                                </Link>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-lg" title="Sửa" onClick={() => openEdit(c)}>
                                  <MaterialIcon name="edit" className="text-xl" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 rounded-lg" title="Xoá" onClick={() => handleDeleteClass(c.id)}>
                                  <MaterialIcon name="delete" className="text-xl" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Hiển thị {classes.length} lớp học</p>
                </div>
              </>
            )}
          </div>

          {/* Stats Bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 flex items-start justify-between shadow-sm hover:shadow-md transition-all group">
              <div>
                <p className="text-gray-500 font-medium mb-1">Tổng số lớp</p>
                <h3 className="text-3xl font-bold text-gray-900">{classes.length}</h3>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:rotate-6 transition-transform">
                <MaterialIcon name="meeting_room" className="text-[28px]" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 flex items-start justify-between shadow-sm hover:shadow-md transition-all group">
              <div>
                <p className="text-gray-500 font-medium mb-1">Khối lớp</p>
                <h3 className="text-3xl font-bold text-gray-900">{gradeLevels.length}</h3>
              </div>
              <div className="p-3 bg-pink-50 text-pink-600 rounded-xl group-hover:rotate-6 transition-transform">
                <MaterialIcon name="layers" className="text-[28px]" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 flex items-start justify-between shadow-sm hover:shadow-md transition-all group">
              <div>
                <p className="text-gray-500 font-medium mb-1">Giáo viên</p>
                <h3 className="text-3xl font-bold text-gray-900">{teachers.length}</h3>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:rotate-6 transition-transform">
                <MaterialIcon name="person_check" className="text-[28px]" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* === TAB: Khối lớp === */}
      {tab === "grade-levels" && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">Quản lí khối lớp</h2>
              <p className="text-sm text-gray-500">Tạo và quản lí các khối lớp (lớp 10, lớp 11, ...)</p>
            </div>
            <Dialog open={glDialogOpen} onOpenChange={(open) => { setGlDialogOpen(open); if (!open) { setEditingGl(null); setGlError(""); } }}>
              <DialogTrigger render={<Button onClick={openAddGl} className="shadow-lg shadow-primary/20 rounded-xl"><MaterialIcon name="add" className="text-xl mr-1.5" />Thêm khối lớp</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingGl ? "Sửa khối lớp" : "Thêm khối lớp"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Tên khối</Label>
                    <Input value={glForm.name} onChange={(e) => setGlForm({ ...glForm, name: e.target.value })} placeholder="Ví dụ: Lớp 10" />
                  </div>
                  <div>
                    <Label>Cấp độ</Label>
                    <Input type="number" value={glForm.level} onChange={(e) => setGlForm({ ...glForm, level: e.target.value })} placeholder="Ví dụ: 10" />
                  </div>
                  {glError && <p className="text-sm text-red-500">{glError}</p>}
                  <Button onClick={handleSaveGl} disabled={glSaving} className="w-full">
                    {glSaving ? "Đang lưu..." : editingGl ? "Cập nhật" : "Tạo"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            {loading ? (
              <div className="p-6"><Skeleton className="h-40 w-full" /></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80">
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Tên khối</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-center">Cấp độ</TableHead>
                      <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeLevels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-400 py-12">Chưa có khối lớp nào</TableCell>
                      </TableRow>
                    ) : (
                      gradeLevels.map((gl) => (
                        <TableRow key={gl.id} className="group hover:bg-gray-50/70 transition-colors">
                          <TableCell className="py-5 font-semibold text-gray-900">{gl.name}</TableCell>
                          <TableCell className="py-5 text-center">
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">{gl.level}</span>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-lg" title="Sửa" onClick={() => openEditGl(gl)}>
                                <MaterialIcon name="edit" className="text-xl" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 rounded-lg" title="Xoá" onClick={() => handleDeleteGl(gl.id)}>
                                <MaterialIcon name="delete" className="text-xl" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">Hiển thị {gradeLevels.length} khối lớp</p>
                </div>
              </>
            )}
          </div>
          </>
        )}
    </div>
  );
}
