"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount?: number;
  totalStudents?: number;
  status?: string;
  source?: string;
  createdAt: string;
  studentIds?: string;
  description?: string;
  rubric?: string;
}

interface ClassItem {
  id: string;
  name: string;
}

const statusLabel: Record<string, string> = {
  DRAFT: "Nháp",
  ASSIGNED: "Đã giao",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Đã trả",
  ACCEPTED: "Đã nhận",
};

const subjectFromTitle = (title: string): string => {
  if (title.toLowerCase().includes("toán") || title.toLowerCase().includes("đạo hàm")) return "TOÁN HỌC";
  if (title.toLowerCase().includes("lý") || title.toLowerCase().includes("dòng điện")) return "VẬT LÝ";
  if (title.toLowerCase().includes("văn") || title.toLowerCase().includes("nghị luận")) return "NGỮ VĂN";
  if (title.toLowerCase().includes("anh") || title.toLowerCase().includes("english")) return "TIẾNG ANH";
  if (title.toLowerCase().includes("hoá") || title.toLowerCase().includes("hóa")) return "HOÁ HỌC";
  if (title.toLowerCase().includes("sinh")) return "SINH HỌC";
  if (title.toLowerCase().includes("sử")) return "LỊCH SỬ";
  if (title.toLowerCase().includes("địa")) return "ĐỊA LÝ";
  return "KHÁC";
};

const subjectColor = (subject: string) => {
  const map: Record<string, { bg: string; text: string; bar: string }> = {
    "TOÁN HỌC": { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-600" },
    "VẬT LÝ": { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-600" },
    "NGỮ VĂN": { bg: "bg-pink-50", text: "text-pink-700", bar: "bg-pink-600" },
    "TIẾNG ANH": { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-600" },
    "HOÁ HỌC": { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-600" },
    "SINH HỌC": { bg: "bg-teal-50", text: "text-teal-700", bar: "bg-teal-600" },
    "LỊCH SỬ": { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-600" },
    "ĐỊA LÝ": { bg: "bg-cyan-50", text: "text-cyan-700", bar: "bg-cyan-600" },
  };
  return map[subject] || { bg: "bg-gray-50", text: "text-gray-600", bar: "bg-gray-500" };
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeacherAssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Search & filter
  const [search, setSearch] = useState("");

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
      .then((data) => {
        setAssignments(data);
        setError(null);
      })
      .catch(() =>
        setError("Không thể tải danh sách bài tập. Vui lòng thử lại.")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssignments();
    api<ClassItem[]>("/api/classes")
      .then((d) => setClasses(d || []))
      .catch(() => {});
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
        dueDate: full.dueDate
          ? new Date(full.dueDate as string).toISOString().slice(0, 16)
          : "",
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

  // ---- Derived stats ----
  const filtered = assignments.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      getClassName(a.classId).toLowerCase().includes(q) ||
      subjectFromTitle(a.title).toLowerCase().includes(q)
    );
  });

  const totalAssignments = assignments.length;
  const activeAssignments = assignments.filter((a) =>
    ["ASSIGNED", "SUBMITTED"].includes(a.status || "")
  ).length;
  const needGrading = assignments.filter((a) =>
    a.status === "SUBMITTED" && (a.submissionCount || 0) > 0
  ).length;
  const completed = assignments.filter((a) =>
    ["GRADED", "ACCEPTED", "RETURNED"].includes(a.status || "")
  ).length;

  const totalSubmissions = assignments.reduce((sum, a) => sum + (a.submissionCount || 0), 0);

  // ---- Time helper ----
  const getTimeInfo = (a: AssignmentRow) => {
    if (!a.dueDate || new Date(a.dueDate).getFullYear() < 2000) {
      return { text: "Chưa có hạn", urgent: false, done: false };
    }
    const now = new Date();
    const due = new Date(a.dueDate);
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (a.status === "GRADED" || a.status === "ACCEPTED") {
      return { text: "Đã kết thúc", urgent: false, done: true };
    }
    if (diffDays < 0) {
      return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, urgent: true, done: false };
    }
    if (diffDays === 0) {
      return { text: "Hạn hôm nay", urgent: true, done: false };
    }
    if (diffDays <= 2) {
      return { text: `Còn ${diffDays} ngày`, urgent: true, done: false };
    }
    return { text: `Còn ${diffDays} ngày`, urgent: false, done: false };
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-6xl pb-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <AlertCircle className="size-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchAssignments} className="mt-3">
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <nav className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <Link href="/teacher" className="hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-blue-600 font-bold">Assignments</span>
          </nav>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">
            Danh sách bài tập
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalAssignments} bài tập · {totalSubmissions} bài nộp
          </p>
        </div>
        <Link href="/teacher/assignments/create">
          <Button className="gap-2 rounded-2xl shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 font-bold active:scale-[0.98] transition-transform px-6 py-3">
            <Plus className="size-5" />
            Tạo bài tập mới
          </Button>
        </Link>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Tổng số bài tập */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FileText className="size-8" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Tổng số bài tập
            </p>
            <p className="text-[32px] font-bold tracking-[-0.02em] text-blue-600 leading-none">
              {totalAssignments}
            </p>
          </div>
        </div>

        {/* Đang diễn ra */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Clock className="size-8" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Đang diễn ra
            </p>
            <p className="text-[32px] font-bold tracking-[-0.02em] text-emerald-600 leading-none">
              {activeAssignments}
            </p>
          </div>
        </div>

        {/* Cần chấm bài */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow border-l-4 border-l-pink-500">
          <div className="size-14 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
            <AlertCircle className="size-8" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Cần chấm bài
            </p>
            <p className="text-[32px] font-bold tracking-[-0.02em] text-pink-600 leading-none">
              {needGrading}
            </p>
          </div>
        </div>

        {/* Đã hoàn thành */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Đã hoàn thành
            </p>
            <p className="text-[32px] font-bold tracking-[-0.02em] text-gray-700 leading-none">
              {completed}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài tập..."
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all text-base"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 transition-colors flex-1 md:flex-none justify-center">
            <Filter className="size-4" />
            Lọc bộ môn
          </button>
          <button className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 transition-colors flex-1 md:flex-none justify-center">
            <Calendar className="size-4" />
            Hạn nộp
          </button>
        </div>
      </div>

      {/* Assignment Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <FileText className="size-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">Chưa có bài tập nào</p>
            <Link href="/teacher/assignments/create">
              <Button variant="outline" size="sm" className="mt-3 rounded-xl">
                <Plus className="size-3 mr-1" /> Tạo bài tập đầu tiên
              </Button>
            </Link>
          </div>
        ) : (
          filtered.map((a) => {
            const subj = subjectFromTitle(a.title);
            const colors = subjectColor(subj);
            const timeInfo = getTimeInfo(a);
            const className = getClassName(a.classId);
            const progressTotal = a.totalStudents || a.submissionCount || 30;
            const progressCurrent = a.submissionCount || 0;
            const progressPct =
              progressTotal > 0
                ? Math.round((progressCurrent / progressTotal) * 100)
                : 0;
            const isUrgent = timeInfo.urgent && a.status !== "GRADED";
            const isDone = timeInfo.done || a.status === "GRADED" || a.status === "ACCEPTED";

            return (
              <div
                key={a.id}
                className={`bg-white rounded-2xl border p-6 flex flex-col lg:flex-row lg:items-center gap-6 hover:shadow-lg transition-all group relative overflow-hidden ${
                  isUrgent
                    ? "border-pink-300"
                    : isDone
                    ? "border-gray-100"
                    : "border-gray-100"
                }`}
              >
                {/* Left color bar */}
                <div
                  className={`absolute top-0 left-0 w-1.5 h-full ${
                    isUrgent ? "bg-pink-500" : isDone ? "bg-gray-300" : colors.bar
                  }`}
                />

                {/* Urgent ping */}
                {isUrgent && (
                  <div className="absolute top-3 right-3">
                    <span className="flex size-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-pink-500" />
                    </span>
                  </div>
                )}

                {/* Card content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}
                    >
                      {subj}
                    </span>
                    {className && className !== "—" && (
                      <span className="text-sm text-gray-500">Lớp {className}</span>
                    )}
                    {a.source === "weakness" && (
                      <Badge className="text-[11px] bg-amber-100 text-amber-700">
                        Khắc phục
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {a.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div
                      className={`flex items-center gap-1 ${
                        isUrgent
                          ? "text-pink-600 font-bold"
                          : isDone
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
                    >
                      {isUrgent ? (
                        <AlertCircle className="size-4" />
                      ) : isDone ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <Clock className="size-4" />
                      )}
                      <span>{timeInfo.text}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="size-4" />
                      <span>
                        {a.dueDate && new Date(a.dueDate).getFullYear() > 2000
                          ? `Hạn: ${new Date(a.dueDate).toLocaleDateString("vi-VN")}`
                          : "Không có hạn"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="w-full lg:w-48">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      TIẾN ĐỘ NỘP BÀI
                    </span>
                    <span className="font-bold text-gray-900">
                      {progressCurrent}/{progressTotal}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isUrgent
                          ? "bg-pink-500"
                          : isDone
                          ? "bg-gray-400"
                          : progressPct >= 100
                          ? "bg-emerald-500"
                          : colors.bar
                      }`}
                      style={{ width: `${Math.min(progressPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t lg:border-t-0 pt-4 lg:pt-0 border-gray-100">
                  <Link href={`/teacher/assignments/${a.id}`}>
                    <button className="px-4 py-2 text-blue-600 font-bold text-sm hover:bg-blue-50 rounded-lg transition-colors">
                      Xem chi tiết
                    </button>
                  </Link>
                  {(a.submissionCount || 0) > 0 &&
                    a.status !== "GRADED" &&
                    a.status !== "ACCEPTED" && (
                      <Link href={`/teacher/assignments/${a.id}/submissions`}>
                        <button
                          className={`px-4 py-2 font-bold text-sm rounded-xl shadow-md transition-all ${
                            isUrgent
                              ? "bg-pink-600 text-white shadow-pink-200 hover:bg-pink-700"
                              : "bg-blue-600 text-white shadow-blue-200/20 hover:bg-blue-700"
                          }`}
                        >
                          Chấm {a.submissionCount} bài
                        </button>
                      </Link>
                    )}
                  {(a.submissionCount || 0) > 0 &&
                    (a.status === "GRADED" || a.status === "ACCEPTED") && (
                      <Link href={`/teacher/assignments/${a.id}/submissions`}>
                        <button className="px-4 py-2 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors">
                          Xem kết quả
                        </button>
                      </Link>
                    )}
                  <button
                    onClick={() => handleEditClick(a)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
                    title="Sửa"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"
                    title="Xoá"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Empty state card — always shown at the bottom */}
        <Link href="/teacher/assignments/create">
          <button className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all group">
            <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
              <Plus className="size-7" />
            </div>
            <span className="text-lg font-semibold">
              Thêm bài tập mới cho học sinh
            </span>
          </button>
        </Link>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Hiển thị {filtered.length} trên {totalAssignments} bài tập
        </p>
        <div className="flex items-center gap-2">
          <button className="size-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors" disabled>
            <ChevronLeft className="size-4" />
          </button>
          <button className="size-10 flex items-center justify-center rounded-xl bg-blue-600 text-white font-bold">1</button>
          <button className="size-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingAssignment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAssignment(null);
            setEditForm({});
            setEditError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAssignment
                ? `Sửa: ${editingAssignment.title}`
                : "Sửa bài tập"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {editError && (
              <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">
                {editError}
              </div>
            )}
            <div>
              <Label htmlFor="edit-title">Tiêu đề</Label>
              <Input
                id="edit-title"
                value={editForm.title || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-desc">Mô tả</Label>
              <Textarea
                id="edit-desc"
                value={editForm.description || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-rubric">Tiêu chí chấm điểm</Label>
              <Textarea
                id="edit-rubric"
                value={editForm.rubric || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, rubric: e.target.value })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-score">Điểm tối đa</Label>
                <Input
                  id="edit-score"
                  type="number"
                  value={editForm.maxScore || "100"}
                  onChange={(e) =>
                    setEditForm({ ...editForm, maxScore: e.target.value })
                  }
                  min={1}
                />
              </div>
              <div>
                <Label htmlFor="edit-due">Hạn nộp</Label>
                <Input
                  id="edit-due"
                  type="datetime-local"
                  value={editForm.dueDate || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, dueDate: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-resubmit"
                checked={editForm.allowResubmit === "true"}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    allowResubmit: String(e.target.checked),
                  })
                }
                className="size-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-resubmit" className="cursor-pointer">
                Cho phép nộp lại
              </Label>
            </div>
            <Button
              onClick={handleEditSave}
              disabled={savingEdit}
              className="w-full"
            >
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
