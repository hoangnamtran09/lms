"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil, School, GraduationCap } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
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
    setLoading(true);
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

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {([
          { key: "classes", label: "Lớp học", icon: School },
          { key: "grade-levels", label: "Khối lớp", icon: GraduationCap },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* === TAB: Lớp học === */}
      {tab === "classes" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lí lớp học</h1>
              <p className="text-sm text-gray-500 mt-1">Tạo và quản lí các lớp học theo khối</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setError(""); } }}>
              <DialogTrigger render={<Button onClick={openAdd}><Plus className="size-4" />Thêm lớp học</Button>} />
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

          <Card className="rounded-xl ring-1 ring-foreground/10">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4"><Skeleton className="h-40 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên lớp</TableHead>
                      <TableHead>Khối</TableHead>
                      <TableHead>Giáo viên CN</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400 py-8">Chưa có lớp học nào</TableCell>
                      </TableRow>
                    ) : (
                      classes.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium text-gray-900">{c.name}</TableCell>
                          <TableCell className="text-gray-500">{c.gradeLevelName || "—"}</TableCell>
                          <TableCell className="text-gray-500">{c.teacherName || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEdit(c)}><Pencil className="size-3" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteClass(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* === TAB: Khối lớp === */}
      {tab === "grade-levels" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quản lí khối lớp</h1>
              <p className="text-sm text-gray-500 mt-1">Tạo và quản lí các khối lớp (lớp 1, lớp 2, ...)</p>
            </div>
            <Dialog open={glDialogOpen} onOpenChange={(open) => { setGlDialogOpen(open); if (!open) { setEditingGl(null); setGlError(""); } }}>
              <DialogTrigger render={<Button onClick={openAddGl}><Plus className="size-4" />Thêm khối lớp</Button>} />
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

          <Card className="rounded-xl ring-1 ring-foreground/10">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4"><Skeleton className="h-40 w-full" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên khối</TableHead>
                      <TableHead className="text-center">Cấp độ</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeLevels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-400 py-8">Chưa có khối lớp nào</TableCell>
                      </TableRow>
                    ) : (
                      gradeLevels.map((gl) => (
                        <TableRow key={gl.id}>
                          <TableCell className="font-medium text-gray-900">{gl.name}</TableCell>
                          <TableCell className="text-center text-gray-500">{gl.level}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEditGl(gl)}><Pencil className="size-3" /></Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteGl(gl.id)} className="text-red-500 hover:text-red-700"><Trash2 className="size-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
