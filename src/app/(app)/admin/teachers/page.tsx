"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Pencil, Check, X, Plus, ChevronUp, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";

interface TeacherRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  classId: string;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName?: string;
}

interface GradeLevel {
  id: string;
  name: string;
}

export default function AdminTeachersPage() {
  const { user: me } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editClassId, setEditClassId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newClassId, setNewClassId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [editGradeFilter, setEditGradeFilter] = useState("");
  const [createGradeFilter, setCreateGradeFilter] = useState("");

  const fetchTeachers = () => {
    api<TeacherRow[]>("/api/users?role=TEACHER")
      .then(setTeachers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeachers();
    Promise.all([
      api<ClassItem[]>("/api/classes"),
      api<GradeLevel[]>("/api/grade-levels"),
    ]).then(([cls, gl]) => {
      setClasses(cls);
      setGradeLevels(gl);
    }).catch(() => {});
  }, []);

  const filteredClasses = (gradeFilter: string) =>
    gradeFilter ? classes.filter((c) => c.gradeLevelId === gradeFilter) : classes;

  const getClassName = (classId: string) => {
    const c = classes.find((c) => c.id === classId);
    return c ? `${c.name}${c.gradeLevelName ? ` (${c.gradeLevelName})` : ""}` : classId;
  };

  const startEdit = (t: TeacherRow) => {
    setEditingId(t.id);
    setEditFullName(t.fullName);
    setEditUsername(t.username);
    setEditEmail(t.email || "");
    setEditClassId(t.classId || "");
    const cls = classes.find((c) => c.id === t.classId);
    setEditGradeFilter(cls?.gradeLevelId || "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSave = async (id: string) => {
    if (!editFullName.trim() || !editUsername.trim()) {
      setEditError("Họ tên và tên đăng nhập không được để trống");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await api(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editFullName.trim(),
          username: editUsername.trim(),
          email: editEmail.trim(),
          classId: editClassId.trim(),
        }),
      });
      cancelEdit();
      fetchTeachers();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá giáo viên này?")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      fetchTeachers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newFullName.trim()) {
      setCreateError("Tên đăng nhập, mật khẩu và họ tên không được để trống");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          fullName: newFullName.trim(),
          email: newEmail.trim(),
          classId: newClassId.trim(),
          role: "TEACHER",
        }),
      });
      setNewUsername("");
      setNewPassword("");
      setNewFullName("");
      setNewEmail("");
      setNewClassId("");
      setShowCreateForm(false);
      fetchTeachers();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Tạo giáo viên thất bại");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={120} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lí Giáo viên</h1>
          <p className="text-sm text-gray-500 mt-1">{teachers.length} giáo viên</p>
        </div>
        <Button onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(null); }} className="gap-2">
          {showCreateForm ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
          {showCreateForm ? "Thu gọn" : "Tạo giáo viên"}
        </Button>
      </div>

      {createError && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{createError}</div>
      )}

      {showCreateForm && (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-blue-100">
                <UserPlus className="size-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tạo giáo viên mới</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-username">Tên đăng nhập</Label>
                  <Input
                    id="new-username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">Mật khẩu</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                  />
                </div>
                <div>
                  <Label htmlFor="new-fullname">Họ tên</Label>
                  <Input
                    id="new-fullname"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Nhập họ tên giáo viên"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-email">Email (tuỳ chọn)</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Nhập email"
                  />
                </div>
                <div>
                  <Label>Khối lớp (lọc)</Label>
                  <select
                    value={createGradeFilter}
                    onChange={(e) => { setCreateGradeFilter(e.target.value); setNewClassId(""); }}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full"
                  >
                    <option value="">Tất cả khối</option>
                    {gradeLevels.map((gl) => (
                      <option key={gl.id} value={gl.id}>{gl.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="new-class">Lớp phụ trách (tuỳ chọn)</Label>
                  <select
                    value={newClassId}
                    onChange={(e) => setNewClassId(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none w-full"
                  >
                    <option value="">-- Chưa chọn --</option>
                    {filteredClasses(createGradeFilter).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}{c.gradeLevelName ? ` (${c.gradeLevelName})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleCreate} disabled={creating} className="gap-2">
                    <Plus className="size-4" />
                    {creating ? "Đang tạo..." : "Tạo giáo viên"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreateForm(false); setCreateError(null); }}>
                    Huỷ
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editError && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{editError}</div>
      )}

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Lớp phụ trách</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Không có giáo viên nào
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((t) => {
                  const isEditing = editingId === t.id;
                  return (
                    <TableRow key={t.id} className={isEditing ? "bg-blue-50/50" : ""}>
                      <TableCell className="font-medium text-gray-900">
                        {isEditing ? (
                          <Input
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                          />
                        ) : (
                          t.fullName
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {isEditing ? (
                          <Input
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                          />
                        ) : (
                          t.username
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {isEditing ? (
                          <Input
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                          />
                        ) : (
                          t.email || "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={editClassId}
                            onChange={(e) => setEditClassId(e.target.value)}
                            className="h-8 text-xs px-2 rounded border border-gray-200 w-full"
                          >
                            <option value="">-- Chưa chọn --</option>
                            {filteredClasses(editGradeFilter).map((c) => (
                              <option key={c.id} value={c.id}>{c.name}{c.gradeLevelName ? ` (${c.gradeLevelName})` : ""}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant="outline" className="text-xs">{getClassName(t.classId) || "—"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSave(t.id)}
                                disabled={saving}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <Check className="size-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                <X className="size-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(t)}
                                disabled={editingId !== null || t.id === me?.id}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(t.id)}
                                disabled={t.id === me?.id || editingId !== null}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
