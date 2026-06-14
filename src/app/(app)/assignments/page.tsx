"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Calendar,
  FileText,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock4,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  maxScore: number;
  dueDate: string;
  status: string;
  source: string;
  creatorName: string;
  createdAt: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: string;
  score: number | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

const subjectIcons: Record<string, string> = {
  "Toán học": "∑",
  "Ngữ văn": "文",
  "Vật lý": "⚛",
  "Hóa học": "⚗",
  "Sinh học": "🧬",
  "Tiếng Anh": "A",
  "Lịch sử": "📜",
  "Địa lý": "🌍",
  "Giáo dục công dân": "⚖",
};

function getSubjectIcon(name: string): string {
  for (const [key, icon] of Object.entries(subjectIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return "📚";
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "short",
  });
}

export default function AssignmentsPage() {
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [myStatuses, setMyStatuses] = useState<Record<string, string>>({});
  const [myScores, setMyScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch subjects for filter + color mapping
    api<SubjectInfo[]>("/api/subjects")
      .then(setSubjects)
      .catch(() => {});

    // Fetch assignments
    api<Assignment[]>("/api/assignments")
      .then(async (list) => {
        setAssignments(list);
        // First check sessionStorage
        const statuses: Record<string, string> = {};
        const scores: Record<string, number | null> = {};
        list.forEach((a) => {
          try {
            if (sessionStorage.getItem(`submitted-${a.id}`) === "true") {
              statuses[a.id] = "SUBMITTED";
            }
          } catch {}
        });
        // Then fetch submission status from API
        if (list.length > 0) {
          const results = await Promise.allSettled(
            list.map((a) =>
              api<Submission[]>(`/api/assignments/${a.id}/submissions`).then(
                (subs) => [a.id, subs.find((s) => s.studentId === user?.id || s.studentId === user?.supabaseId)] as const
              )
            )
          );
          results.forEach((r) => {
            if (r.status === "fulfilled") {
              const [assignmentId, sub] = r.value;
              if (sub?.status) {
                statuses[assignmentId] = sub.status;
                if (sub.score != null) scores[assignmentId] = sub.score;
                try { sessionStorage.setItem(`submitted-${assignmentId}`, "true"); } catch {}
              }
            }
          });
        }
        setMyStatuses(statuses);
        setMyScores(scores);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Build subject lookup map
  const subjectMap = useMemo(() => {
    const map: Record<string, SubjectInfo> = {};
    subjects.forEach((s) => { map[s.id] = s; });
    return map;
  }, [subjects]);

  // Filter assignments
  const filtered = useMemo(() => {
    return assignments.filter((a) => {
      if (subjectFilter !== "all" && a.subjectId !== subjectFilter) return false;
      const effectiveStatus = myStatuses[a.id] || a.status;
      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const subjectName = subjectMap[a.subjectId]?.name || "";
        if (
          !a.title.toLowerCase().includes(q) &&
          !subjectName.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [assignments, myStatuses, subjectFilter, statusFilter, searchQuery, subjectMap]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-8">
        <Skeleton delay={0} className="h-9 w-56 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} delay={80 + i * 100} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-gray-900">Không thể tải danh sách bài tập</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-primary mb-1">
            Quản lý bài tập
          </h1>
          <p className="text-base text-gray-500 max-w-lg">
            Theo dõi tiến độ học tập và hoàn thành các bài đánh giá để đạt được mục tiêu học tập của bạn.
          </p>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-4 shrink-0">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 text-center min-w-[100px]">
            <p className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mb-1">Tổng số</p>
            <p className="text-2xl font-bold text-primary">{assignments.length}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl shadow-sm border border-blue-100 text-center min-w-[100px]">
            <p className="text-primary text-[10px] uppercase font-bold tracking-widest mb-1">Đã nộp</p>
            <p className="text-2xl font-bold text-primary">{Object.values(myStatuses).filter(s => s === "SUBMITTED" || s === "GRADED" || s === "ACCEPTED").length}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-2xl shadow-sm border border-red-100 text-center min-w-[100px]">
            <p className="text-red-500 text-[10px] uppercase font-bold tracking-widest mb-1">Quá hạn</p>
            <p className="text-2xl font-bold text-red-500">{assignments.filter(a => (myStatuses[a.id] || a.status) === "ASSIGNED" && isOverdue(a.dueDate)).length}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap gap-4 items-center mb-8">
        <div className="flex-1 relative min-w-[280px]">
          <Search className="size-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
            placeholder="Tìm kiếm theo tên bài tập..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600 focus:ring-primary focus:border-primary"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">Tất cả môn học</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600 focus:ring-primary focus:border-primary"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Trạng thái: Tất cả</option>
          <option value="ASSIGNED">Chưa làm</option>
          <option value="SUBMITTED">Đang chờ</option>
          <option value="GRADED">Đã chấm</option>
          <option value="RETURNED">Cần sửa</option>
          <option value="ACCEPTED">Đã duyệt</option>
        </select>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FileText className="size-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-lg font-medium">Chưa có bài tập nào</p>
          <p className="text-sm text-gray-400 mt-1">
            {assignments.length === 0
              ? "Bài tập sẽ xuất hiện ở đây khi giáo viên giao cho bạn."
              : "Thử điều chỉnh bộ lọc để xem thêm."}
          </p>
        </div>
      ) : (
        <>
          {/* Assignment Cards */}
          <div className="space-y-4">
            {filtered.map((a) => {
              const sub = subjectMap[a.subjectId];
              const subjectName = sub?.name || "Môn học";
              const effectiveStatus = myStatuses[a.id] || a.status;
              const overdue = effectiveStatus === "ASSIGNED" && isOverdue(a.dueDate);
              const score = myScores[a.id];
              const isGraded = (effectiveStatus === "GRADED" || effectiveStatus === "ACCEPTED") && score != null;
              const isSubmitted = effectiveStatus === "SUBMITTED";

              const statusBadge = overdue
                ? "bg-red-100 text-red-700"
                : isGraded
                ? "bg-emerald-100 text-emerald-700"
                : isSubmitted
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700";

              const progressPct = isGraded ? 100 : isSubmitted ? 80 : 0;
              const progressColor = isGraded ? "bg-emerald-500" : isSubmitted ? "bg-amber-400" : "bg-gray-200";

              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        isGraded ? "bg-emerald-100 text-emerald-600" :
                        isSubmitted ? "bg-amber-100 text-amber-600" :
                        overdue ? "bg-red-100 text-red-600" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        {getSubjectIcon(subjectName)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors">{a.title}</h3>
                        <p className="text-gray-500 text-sm">{subjectName} • {a.creatorName || "Giáo viên"}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 ${statusBadge}`}>
                      {overdue ? "Quá hạn" : isGraded ? "Đã chấm" : isSubmitted ? "Đang chờ" : "Chưa làm"}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 mb-6 text-sm">
                    {a.dueDate && new Date(a.dueDate).getFullYear() > 1 && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="size-4" />
                        <span>{overdue ? "Quá hạn: " : "Hạn chót: "}{formatDate(a.dueDate)}</span>
                      </div>
                    )}
                    {isSubmitted && (
                      <div className="flex items-center gap-2 text-amber-600 font-medium">
                        <Clock4 className="size-4" />
                        <span>Chờ chấm điểm</span>
                      </div>
                    )}
                    {isGraded && (
                      <div className="flex items-center gap-2 text-emerald-600 font-medium">
                        <CheckCircle2 className="size-4" />
                        <span>Điểm: {score}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-600">{progressPct}%</span>
                    <Link
                      href={`/assignments/${a.id}`}
                      className={`ml-auto px-6 py-2 rounded-xl font-bold text-sm transition-colors active:scale-95 ${
                        overdue ? "bg-red-600 text-white hover:bg-red-700" :
                        isGraded ? "bg-emerald-600 text-white hover:bg-emerald-700" :
                        isSubmitted ? "border border-gray-300 text-gray-600 hover:bg-gray-50" :
                        "bg-primary text-white hover:bg-primary/90"
                      }`}
                    >
                      {overdue ? "Nộp bài muộn" : isGraded ? "Xem phản hồi" : isSubmitted ? "Xem bài nộp" : "Tiếp tục"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">
              Hiển thị {filtered.length} trên {assignments.length} bài tập
            </p>
          </div>
        </>
      )}
    </div>
  );
}
