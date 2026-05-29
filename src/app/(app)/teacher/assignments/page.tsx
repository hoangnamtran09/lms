"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Trash2, Plus, ClipboardList, FileText, Users, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount?: number;
  createdAt: string;
  studentIds?: string;
  status?: string;
}

const statusLabel: Record<string, string> = {
  DRAFT: "Nháp",
  ASSIGNED: "Đã giao",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Đã trả",
  ACCEPTED: "Đã nhận",
};

const statusVariant: Record<string, "outline" | "default" | "secondary"> = {
  DRAFT: "secondary",
  ASSIGNED: "default",
  SUBMITTED: "outline",
  GRADED: "outline",
  RETURNED: "outline",
  ACCEPTED: "outline",
};

interface ClassItem {
  id: string;
  name: string;
}

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Edit form
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const getClassName = (classId: string) => {
    const c = classes.find((c) => c.id === classId);
    return c ? c.name : classId;
  };

  const fetchAssignments = () => {
    api<AssignmentRow[]>("/api/assignments")
      .then((data) => { setAssignments(data); setError(null); })
      .catch(() => setError("Không thể tải danh sách bài tập. Vui lòng thử lại."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
    api<ClassItem[]>("/api/classes").then((d) => setClasses(d || [])).catch(() => {});
  }, []);

  const handleEditClick = async (a: AssignmentRow) => {
    setEditingAssignment(a);
    try {
      const full = await api<Record<string, unknown>>(`/api/assignments/${a.id}`);
      setEditForm({
        title: (full.title as string) || "",
        description: (full.description as string) || "",
        rubric: (full.rubric as string) || "",
        maxScore: String((full.maxScore as number) ?? 100),
        dueDate: full.dueDate ? new Date(full.dueDate as string).toISOString().slice(0, 16) : "",
        allowResubmit: full.allowResubmit ? "true" : "false",
      });
      setEditError(null);
    } catch {
      setEditError("Không thể tải thông tin bài tập");
    }
  };

  const handleEditSave = async () => {
    if (!editingAssignment) return;
    if (!editForm.title?.trim()) {
      setEditError("Tiêu đề không được để trống");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        rubric: editForm.rubric.trim(),
        maxScore: parseInt(editForm.maxScore || "100"),
        allowResubmit: editForm.allowResubmit === "true",
      };
      body.dueDate = editForm.dueDate
        ? new Date(editForm.dueDate).toISOString()
        : new Date().toISOString();
      await api(`/api/assignments/${editingAssignment.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditingAssignment(null);
      setEditForm({});
      fetchAssignments();
    } catch (e: unknown) {
      setEditError(e instanceof ApiError ? e.message : "Cập nhật thất bại");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá bài tập này? Tất cả bài nộp liên quan sẽ bị mất.")) return;
    try {
      await api(`/api/assignments/${id}`, { method: "DELETE" });
      fetchAssignments();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const totalSubmissions = assignments.reduce((sum, a) => sum + (a.submissionCount || 0), 0);
  const pendingCount = assignments.filter((a) => (a.submissionCount || 0) > 0).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-10 w-40" />
        <Skeleton delay={200} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">{assignments.length} bài tập · {totalSubmissions} bài nộp</p>
        </div>
        <Link href="/teacher/assignments/create">
          <Button className="gap-2">
            <Plus className="size-4" />
            Tạo bài tập
          </Button>
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchAssignments}>Thử lại</Button>
        </div>
      )}

      {/* Stats mini cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100">
              <ClipboardList className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng bài tập</p>
              <p className="text-xl font-bold text-gray-900">{assignments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-100">
              <FileText className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng bài nộp</p>
              <p className="text-xl font-bold text-gray-900">{totalSubmissions}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-amber-100">
              <Users className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Đã có bài nộp</p>
              <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Assignments table */}
      <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-center">Điểm tối đa</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead className="text-center">Bài nộp</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <ClipboardList className="size-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">Chưa có bài tập nào</p>
                    <Link href="/teacher/assignments/create">
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="size-3 mr-1" /> Tạo bài tập đầu tiên
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-gray-900">{a.title}</TableCell>
                    <TableCell>
                      {a.classId ? (
                        <Badge variant="outline" className="text-xs">{getClassName(a.classId)}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant[a.status || "DRAFT"] || "secondary"} className="text-xs">
                        {statusLabel[a.status || "DRAFT"] || a.status || "Nháp"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-gray-500">{a.maxScore}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {a.dueDate && new Date(a.dueDate).getFullYear() > 1 ? new Date(a.dueDate).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={(a.submissionCount || 0) > 0 ? "default" : "outline"} className="text-xs">
                        {a.submissionCount ?? 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(a)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Link href={`/teacher/assignments/${a.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="size-3" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)}
                          className="text-red-500 hover:text-red-700">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => { if (!open) { setEditingAssignment(null); setEditForm({}); setEditError(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAssignment ? `Sửa: ${editingAssignment.title}` : "Sửa bài tập"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {editError && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">{editError}</div>}
            <div>
              <Label htmlFor="edit-title">Tiêu đề</Label>
              <Input id="edit-title" value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-desc">Mô tả</Label>
              <Textarea id="edit-desc" value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label htmlFor="edit-rubric">Tiêu chí chấm điểm</Label>
              <Textarea id="edit-rubric" value={editForm.rubric || ""} onChange={(e) => setEditForm({ ...editForm, rubric: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-score">Điểm tối đa</Label>
                <Input id="edit-score" type="number" value={editForm.maxScore || "100"} onChange={(e) => setEditForm({ ...editForm, maxScore: e.target.value })} min={1} />
              </div>
              <div>
                <Label htmlFor="edit-due">Hạn nộp</Label>
                <Input id="edit-due" type="datetime-local" value={editForm.dueDate || ""} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-resubmit" checked={editForm.allowResubmit === "true"} onChange={(e) => setEditForm({ ...editForm, allowResubmit: String(e.target.checked) })} className="size-4 rounded border-gray-300" />
              <Label htmlFor="edit-resubmit" className="cursor-pointer">Cho phép nộp lại</Label>
            </div>
            <Button onClick={handleEditSave} disabled={savingEdit} className="w-full">
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
