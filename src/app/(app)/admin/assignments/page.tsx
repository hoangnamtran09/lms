"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Trash2, Plus, ChevronDown, ChevronUp, ClipboardList, FileText, Users } from "lucide-react";
import { api, ApiError, uploadFile } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount: number;
  createdAt: string;
  studentIds?: string;
}

interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
}

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const fetchAssignments = () => {
    api<AssignmentRow[]>("/api/assignments")
      .then((data) => setAssignments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
    api<StudentBrief[]>("/api/users?role=STUDENT")
      .then((data) => setStudents(data))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      setCreateError("Vui lòng nhập tiêu đề bài tập");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      let attachmentUrl = "";
      if (selectedFile) {
        const uploadResult = await uploadFile("/api/assignments/upload", selectedFile);
        attachmentUrl = uploadResult.url;
      }
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
        maxScore,
        classId: classId.trim(),
        attachmentUrl,
        studentIds: selectedStudentIds.length > 0 ? JSON.stringify(selectedStudentIds) : "",
      };
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTitle("");
      setDescription("");
      setRubric("");
      setMaxScore(100);
      setClassId("");
      setDueDate("");
      setSelectedFile(null);
      setSelectedStudentIds([]);
      setShowForm(false);
      fetchAssignments();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Tạo bài tập thất bại");
    } finally {
      setSubmitting(false);
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

  const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissionCount, 0);
  const pendingCount = assignments.filter((a) => a.submissionCount > 0).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">{assignments.length} bài tập · {totalSubmissions} bài nộp</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="gap-2">
          {showForm ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Thu gọn" : "Tạo bài tập"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-blue-100">
                <ClipboardList className="size-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tạo bài tập mới</h2>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{createError}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Tiêu đề</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Nhập tiêu đề bài tập"
                  />
                </div>
                <div>
                  <Label htmlFor="desc">Mô tả / Câu hỏi</Label>
                  <Textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập nội dung câu hỏi hoặc yêu cầu bài tập"
                    rows={5}
                  />
                </div>
                <div>
                  <Label htmlFor="rubric">Tiêu chí chấm điểm</Label>
                  <Textarea
                    id="rubric"
                    value={rubric}
                    onChange={(e) => setRubric(e.target.value)}
                    placeholder="VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%"
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="score">Điểm tối đa</Label>
                    <Input
                      id="score"
                      type="number"
                      value={maxScore}
                      onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
                      min={1}
                      max={10}
                    />
                  </div>
                  <div>
                    <Label htmlFor="class">Lớp (tuỳ chọn)</Label>
                    <Input
                      id="class"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      placeholder="ID của lớp"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="due">Hạn nộp (tuỳ chọn)</Label>
                  <Input
                    id="due"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="file">Tệp PDF đính kèm (tuỳ chọn)</Label>
                  {selectedFile ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-600 truncate flex-1">{selectedFile.name}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="text-red-500 hover:text-red-700 shrink-0"
                      >
                        Gỡ
                      </Button>
                    </div>
                  ) : (
                    <Input
                      id="file"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  )}
                </div>
                <div>
                  <Label>Học sinh nhận bài (để trống = cả lớp)</Label>
                  {students.length === 0 ? (
                    <p className="text-sm text-gray-400 mt-1">Đang tải danh sách học sinh...</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-0.5 mt-1">
                      {students.map((s) => (
                        <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStudentIds.includes(s.supabaseId)}
                            onChange={() => {
                              setSelectedStudentIds((prev) =>
                                prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId]
                              );
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{s.fullName}</span>
                          <span className="text-xs text-gray-400 ml-auto">{s.username}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedStudentIds.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleCreate} disabled={submitting} className="gap-2">
                    <Plus className="size-4" />
                    {submitting ? "Đang tạo..." : "Tạo bài tập"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Huỷ
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
                <TableHead className="text-center">Điểm tối đa</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead className="text-center">Bài nộp</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <ClipboardList className="size-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">Chưa có bài tập nào</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                      <Plus className="size-3 mr-1" /> Tạo bài tập đầu tiên
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-gray-900">{a.title}</TableCell>
                    <TableCell>
                      {a.classId ? (
                        <Badge variant="outline" className="text-xs">{a.classId}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-gray-500">{a.maxScore}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {a.dueDate ? new Date(a.dueDate).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.submissionCount > 0 ? "default" : "outline"} className="text-xs">
                        {a.submissionCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/assignments/${a.id}`}>
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
    </div>
  );
}
