"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Download,
  Send,
  Users,
  CheckCircle2,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Assignment {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  dueDate: string;
  status: string;
  source: string;
  creatorName: string;
  questions: string;
  classId?: string;
  subjectId?: string;
  studentIds?: string;
  createdAt: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileUrl: string;
  score: number | null;
  feedback: string;
  status: string;
  submittedAt: string;
  gradedAt: string | null;
  gradedBy: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectInfo {
  id: string;
  name: string;
}

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tất cả");
  const [sortBy, setSortBy] = useState("Mới nhất");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    Promise.all([
      api<Assignment>(`/api/assignments/${id}`),
      api<Submission[]>(`/api/assignments/${id}/submissions`),
      api<ClassItem[]>("/api/classes"),
      api<SubjectInfo[]>("/api/subjects"),
    ])
      .then(([a, s, c, subj]) => {
        setAssignment(a);
        setSubmissions(s);
        setClasses(c || []);
        setSubjects(subj || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ---- Derived data ----
  const totalStudents = (() => {
    if (assignment?.studentIds) {
      try {
        const parsed = JSON.parse(assignment.studentIds);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.length;
      } catch {}
    }
    // Fall back to unique submission count if studentIds unavailable
    const uniqueStudents = new Set(submissions.map((s) => s.studentId));
    return uniqueStudents.size;
  })();
  const submittedCount = submissions.filter((s) => s.status !== "ASSIGNED").length;
  const gradedCount = submissions.filter((s) => s.score != null).length;
  const pendingGradingCount = submissions.filter(
    (s) => s.status === "SUBMITTED" && s.score == null
  ).length;
  const avgScore =
    gradedCount > 0
      ? (
          submissions
            .filter((s) => s.score != null)
            .reduce((sum, s) => sum + (s.score || 0), 0) / gradedCount
        ).toFixed(1)
      : "--";
  const submitRate =
    totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;

  // Filter & sort
  const filtered = submissions
    .filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.studentName.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === "Đã chấm" && s.score == null) return false;
      if (statusFilter === "Chờ chấm" && !(s.status === "SUBMITTED" && s.score == null))
        return false;
      if (statusFilter === "Chưa nộp" && s.status !== "ASSIGNED") return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "Điểm cao nhất")
        return (b.score || -1) - (a.score || -1);
      if (sortBy === "Tên (A-Z)")
        return a.studentName.localeCompare(b.studentName);
      // Mới nhất
      return (
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  // ---- Render helpers ----
  const className = classes.find((c) => c.id === assignment?.classId)?.name || "—";
  const subjectName = subjects.find((s) => s.id === assignment?.subjectId)?.name || "—";

  const renderStatusBadge = (sub: Submission) => {
    const isGraded = sub.score != null;
    const isPending = sub.status === "SUBMITTED" && sub.score == null;
    const isNotSubmitted = sub.status === "ASSIGNED";

    if (isGraded) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" />
          Đã chấm
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-sm font-medium text-pink-700">
          <span className="size-2 rounded-full bg-pink-500 animate-pulse" />
          Chờ chấm
        </span>
      );
    }
    if (isNotSubmitted) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-500">
          <span className="size-2 rounded-full bg-gray-400" />
          Chưa nộp
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
        {statusLabel[sub.status] || sub.status}
      </span>
    );
  };

  // ---- Loading / Error ----
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <p className="text-gray-500">{error || "Không tìm thấy bài tập"}</p>
        <Link
          href="/teacher/assignments"
          className="text-sm text-primary hover:underline mt-2 inline-block"
        >
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link href="/teacher/assignments" className="hover:text-primary transition-colors">
          Assignments
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`/teacher/assignments/${id}`}
          className="hover:text-primary transition-colors"
        >
          {assignment.title}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-primary font-semibold">Danh sách bài nộp</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-1">
            Danh sách bài nộp
          </h2>
          <p className="text-base text-gray-500">
            Bài tập: <span className="font-semibold text-gray-900">{assignment.title}</span>
            {" | "}Môn: <span className="font-semibold text-gray-900">{subjectName}</span>
            {" | "}Lớp: <span className="font-semibold text-gray-900">{className}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Download className="size-4" />
            Xuất báo cáo
          </Button>
          <Button className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700">
            <Send className="size-4" />
            Nhắc nhở cả lớp
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Tổng số học sinh */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Users className="size-5" />
            </div>
            <button className="text-gray-300 hover:text-blue-600 transition-colors">
              <Info className="size-4" />
            </button>
          </div>
          <p className="text-sm text-gray-500">Tổng số học sinh</p>
          <h3 className="text-2xl font-semibold text-gray-900">
            {totalStudents} Học sinh
          </h3>
        </div>

        {/* Đã nộp bài */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="text-right">
              <span className="text-emerald-600 font-bold text-sm">{submitRate}%</span>
            </div>
          </div>
          <p className="text-sm text-gray-500">Đã nộp bài</p>
          <h3 className="text-2xl font-semibold text-gray-900">
            {submittedCount}/{totalStudents}
          </h3>
        </div>

        {/* Điểm trung bình */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-pink-50 text-pink-600">
              <Star className="size-5" />
            </div>
            <Info className="size-4 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">Điểm trung bình</p>
          <h3 className="text-2xl font-semibold text-gray-900">
            {avgScore}/{assignment.maxScore}
          </h3>
        </div>

        {/* Đang chờ chấm */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow group border-l-4 border-l-pink-500">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-pink-50 text-pink-600">
              <Clock className="size-5" />
            </div>
            <span className="flex size-2 rounded-full bg-pink-500 animate-ping" />
          </div>
          <p className="text-sm text-gray-500">Đang chờ chấm</p>
          <h3 className="text-2xl font-semibold text-gray-900">
            {pendingGradingCount} bài
          </h3>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm tên học sinh..."
                className="pl-10 rounded-xl bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-500">Trạng thái:</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option>Tất cả</option>
                <option>Đã chấm</option>
                <option>Chờ chấm</option>
                <option>Chưa nộp</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-500">Sắp xếp:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option>Mới nhất</option>
                <option>Điểm cao nhất</option>
                <option>Tên (A-Z)</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-400">
            Hiển thị {Math.min(paged.length, perPage)}/{filtered.length} kết quả
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Học sinh
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Thời gian nộp
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Điểm số
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 text-right">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Users className="size-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400">Không tìm thấy bài nộp nào</p>
                  </td>
                </tr>
              ) : (
                paged.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                          {sub.studentName?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {sub.studentName}
                          </p>
                          <p className="text-sm text-gray-400">
                            ID: {sub.studentId?.slice(0, 8) || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sub.submittedAt && new Date(sub.submittedAt).getFullYear() > 1
                        ? new Date(sub.submittedAt).toLocaleString("vi-VN")
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {sub.score != null ? (
                        <span className="inline-flex items-center justify-center size-10 rounded-full bg-emerald-50 text-emerald-600 font-bold">
                          {sub.score}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center size-10 rounded-full bg-gray-100 text-gray-400 font-bold">
                          --
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">{renderStatusBadge(sub)}</td>
                    <td className="px-6 py-4 text-right">
                      {sub.score != null || sub.status === "GRADED" ? (
                        <button
                          onClick={() =>
                            router.push(
                              `/teacher/assignments/${id}/submissions/${sub.id}`
                            )
                          }
                          className="text-blue-600 font-semibold text-sm hover:underline"
                        >
                          Xem chi tiết
                        </button>
                      ) : sub.status === "SUBMITTED" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/teacher/assignments/${id}/submissions/${sub.id}`
                            )
                          }
                          className="rounded-lg bg-blue-600 hover:bg-blue-700"
                        >
                          Chấm bài
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                        >
                          Nhắc nhở
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-400 hidden sm:block">
              Trang {page} của {totalPages}
            </p>
            <div className="flex items-center gap-2 mx-auto sm:mx-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="size-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`size-10 flex items-center justify-center rounded-lg font-bold text-sm ${
                      pageNum === page
                        ? "bg-blue-600 text-white"
                        : "border border-gray-200 hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="size-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="mt-6 flex flex-col md:flex-row gap-6">
        {/* AI Help */}
        <div className="flex-1 p-6 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-blue-600 rounded-full text-white shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-blue-900 mb-1">
              Cần hỗ trợ chấm bài?
            </h4>
            <p className="text-sm text-blue-700">
              Bạn có thể sử dụng tính năng{" "}
              <strong>Trợ lý AI</strong> để gợi ý nhận xét và phân tích nhanh các
              lỗi sai phổ biến của học sinh.
            </p>
            <button className="mt-2 text-blue-600 font-bold text-sm hover:underline">
              Khám phá ngay →
            </button>
          </div>
        </div>

        {/* Grading Progress */}
        <div className="w-full md:w-80 p-6 bg-gray-50 rounded-2xl border border-gray-100">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Tiến độ chung
          </h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Hoàn thành chấm</span>
                <span className="font-bold text-emerald-600">
                  {gradedCount}/{submittedCount}
                </span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      submittedCount > 0
                        ? Math.round((gradedCount / submittedCount) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Hạn chót chấm bài</span>
                <span className="text-red-500 font-semibold">Còn 2 ngày</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
