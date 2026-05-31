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
  Sparkles,
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

const statusLabel: Record<string, string> = {
  ASSIGNED: "To Do",
  SUBMITTED: "Đang chờ",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa",
  ACCEPTED: "Đã duyệt",
};

// Map status to card theme
const statusTheme: Record<
  string,
  { card: string; icon: string; iconBg: string; button: string; text: string; badge: string }
> = {
  ASSIGNED: {
    card: "border-gray-200",
    icon: "text-primary",
    iconBg: "bg-blue-50",
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
    text: "text-primary",
    badge: "bg-red-50 text-red-700",
  },
  SUBMITTED: {
    card: "border-gray-200",
    icon: "text-secondary",
    iconBg: "bg-pink-50",
    button: "border-2 border-gray-300 text-gray-600 hover:bg-gray-50",
    text: "text-secondary",
    badge: "bg-gray-100 text-gray-600",
  },
  GRADED: {
    card: "border-gray-200",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-50",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
    text: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
  RETURNED: {
    card: "border-red-300 border-dashed",
    icon: "text-destructive",
    iconBg: "bg-red-50",
    button: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    text: "text-destructive",
    badge: "bg-red-50 text-red-700",
  },
  ACCEPTED: {
    card: "border-gray-200",
    icon: "text-emerald-600",
    iconBg: "bg-emerald-50",
    button: "bg-emerald-600 text-white hover:bg-emerald-700",
    text: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700",
  },
};

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
                (subs) => [a.id, subs.find((s) => s.studentId === user?.id)] as const
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
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-1">
            Danh sách bài tập
          </h1>
          <p className="text-base text-gray-500">
            Quản lý và theo dõi tiến độ học tập của bạn.
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="flex items-center bg-white rounded-full px-4 py-2.5 border border-gray-200 w-72 shadow-sm">
            <Search className="size-4 text-gray-400 mr-2 shrink-0" />
            <input
              className="bg-transparent border-none outline-none text-sm w-full"
              placeholder="Tìm kiếm bài tập..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Subject filter */}
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Môn học:
            </span>
            <select
              className="bg-transparent border-none outline-none text-sm font-medium"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {/* Status filter */}
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-200 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
              Trạng thái:
            </span>
            <select
              className="bg-transparent border-none outline-none text-sm font-medium"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="ASSIGNED">Chưa làm</option>
              <option value="SUBMITTED">Đang chờ</option>
              <option value="GRADED">Đã chấm</option>
              <option value="RETURNED">Cần sửa</option>
              <option value="ACCEPTED">Đã duyệt</option>
            </select>
          </div>
        </div>
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
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((a) => {
              const sub = subjectMap[a.subjectId];
              const subjectName = sub?.name || "Môn học";
              const effectiveStatus = myStatuses[a.id] || a.status;
              const theme = statusTheme[effectiveStatus] || statusTheme.ASSIGNED;
              const overdue = effectiveStatus === "ASSIGNED" && isOverdue(a.dueDate);
              const displayTheme = overdue ? statusTheme.RETURNED : theme;
              const score = myScores[a.id];
              const hasScore = (effectiveStatus === "GRADED" || effectiveStatus === "ACCEPTED") && score != null;

              return (
                <div
                  key={a.id}
                  className={`bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-1 transition-all group flex flex-col relative overflow-hidden ${displayTheme.card}`}
                >
                  {/* Score badge for graded assignments */}
                  {hasScore && (
                    <div className="absolute top-0 right-0 px-4 py-2 bg-emerald-600 text-white rounded-bl-2xl font-bold text-lg">
                      {score}
                    </div>
                  )}

                  {/* Icon + Subject badge */}
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-xl group-hover:scale-110 transition-transform ${displayTheme.iconBg} ${displayTheme.icon}`}
                    >
                      {getSubjectIcon(subjectName)}
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200 ${hasScore ? "mr-12" : ""}`}
                    >
                      {subjectName}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className={`text-lg font-semibold mb-2 line-clamp-1 ${displayTheme.text}`}>
                    {a.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-500 mb-6 line-clamp-2">
                    {a.description || "Không có mô tả"}
                  </p>

                  {/* Footer: date + status + action */}
                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1 text-gray-500">
                        {overdue ? (
                          <>
                            <AlertTriangle className="size-3.5 text-destructive" />
                            <span className="text-destructive font-semibold">
                              Quá hạn: {formatDate(a.dueDate)}
                            </span>
                          </>
                        ) : effectiveStatus === "SUBMITTED" ? (
                          <>
                            <Clock4 className="size-3.5" />
                            <span>Đã nộp</span>
                          </>
                        ) : effectiveStatus === "GRADED" || effectiveStatus === "ACCEPTED" ? (
                          <>
                            <CheckCircle2 className="size-3.5" />
                            <span>Đã chấm</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="size-3.5" />
                            <span>
                              {a.dueDate
                                ? `Hạn nộp: ${formatDate(a.dueDate)}`
                                : "Không hạn nộp"}
                            </span>
                          </>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full font-semibold text-xs ${displayTheme.badge}`}
                      >
                        {overdue ? "Quá hạn" : statusLabel[effectiveStatus] || effectiveStatus}
                      </span>
                    </div>

                    {/* Action button */}
                    {effectiveStatus === "ASSIGNED" ? (
                      <Link
                        href={`/assignments/${a.id}`}
                        className={`w-full py-3 rounded-xl font-bold text-sm text-center block transition-colors ${displayTheme.button}`}
                      >
                        {overdue ? "Nộp bài muộn" : "Bắt đầu làm bài"}
                      </Link>
                    ) : effectiveStatus === "SUBMITTED" ? (
                      <Link
                        href={`/assignments/${a.id}`}
                        className={`w-full py-3 rounded-xl font-bold text-sm text-center block transition-colors ${displayTheme.button}`}
                      >
                        Xem lại bài nộp
                      </Link>
                    ) : (
                      <Link
                        href={`/assignments/${a.id}`}
                        className={`w-full py-3 rounded-xl font-bold text-sm text-center block transition-colors ${displayTheme.button}`}
                      >
                        Xem phản hồi
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Promo Banner Card (spans 2 cols on lg screens) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 flex items-center gap-6 text-white shadow-xl relative overflow-hidden group">
              <div className="relative z-10 flex-1">
                <h4 className="text-2xl font-bold mb-4">Cần trợ giúp với bài tập?</h4>
                <p className="text-base mb-6 opacity-90 max-w-md">
                  Sử dụng hệ thống thư viện tài liệu trực tuyến của EduPortal để tìm kiếm tài liệu tham khảo nhanh chóng.
                </p>
                <div className="flex gap-4">
                  <Link
                    href="/courses"
                    className="px-6 py-2.5 bg-white text-primary rounded-full font-bold text-sm hover:scale-105 transition-transform inline-block"
                  >
                    Khám phá ngay
                  </Link>
                  <Link
                    href="/messages"
                    className="px-6 py-2.5 bg-white/20 text-white rounded-full font-bold text-sm hover:bg-white/30 transition-all inline-block"
                  >
                    Hỏi Giáo viên
                  </Link>
                </div>
              </div>
              {/* Decorative */}
              <div className="hidden md:block relative z-10 w-36 h-36 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 flex items-center justify-center transform rotate-6 group-hover:rotate-3 transition-transform">
                <Sparkles className="size-16 text-white/80" />
              </div>
              <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -top-20 -left-20 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
            </div>
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
