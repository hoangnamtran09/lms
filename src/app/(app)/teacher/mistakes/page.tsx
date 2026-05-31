"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, BookOpen, AlertCircle, Users, ChevronRight, Search, BarChart3, Sparkles } from "lucide-react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { MathText } from "@/components/ai/math-text";

interface WeaknessTopic {
  topic: string;
  studentCount: number;
  totalErrors: number;
  subjectName?: string;
  lessonTitle?: string;
  lessonId?: string;
}

interface StudentBrief {
  id: string;
  fullName: string;
  weaknessCount?: number;
}

interface ClassSummary {
  topics: WeaknessTopic[];
  totalWeaknesses: number;
  totalStudents: number;
}

export default function TeacherMistakesPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<WeaknessTopic[]>(`/api/weaknesses/class-summary${user?.classId ? `?classId=${user.classId}` : ""}`).catch(() => []),
      api<StudentBrief[]>("/api/teacher/students").catch(() => []),
    ])
      .then(async ([topics, studentList]) => {
        // Fetch weakness counts per student
        const studentsWithCounts = await Promise.all(
          studentList.map(async (s) => {
            try {
              const weaknesses = await api<{ id: string; resolved: boolean }[]>(`/api/weaknesses?userId=${s.id}`);
              return {
                ...s,
                weaknessCount: Array.isArray(weaknesses) ? weaknesses.filter((w) => !(w as any).resolved).length : 0,
              };
            } catch {
              return { ...s, weaknessCount: 0 };
            }
          })
        );

        const totalWeaknesses = topics.reduce((sum, t) => sum + t.totalErrors, 0);
        setSummary({
          topics: Array.isArray(topics) ? topics : [],
          totalWeaknesses,
          totalStudents: studentsWithCounts.filter((s) => s.weaknessCount && s.weaknessCount > 0).length,
        });
        setStudents(studentsWithCounts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.classId]);

  const filteredStudents = students
    .filter((s) => s.weaknessCount && s.weaknessCount > 0)
    .filter((s) => s.fullName.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (b.weaknessCount || 0) - (a.weaknessCount || 0));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} delay={80 + i * 80} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton delay={200} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto px-4 md:px-8 py-8">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-3"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      {/* Header with step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-2 px-4 py-1 bg-primary text-white rounded-full text-xs font-bold">
            Bước 2
          </div>
          <span className="text-sm text-gray-500 font-medium">Phân tích & Chọn chủ đề</span>
        </div>
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">Khắc phục điểm yếu</h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi và khắc phục điểm yếu của học sinh trong lớp
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle className="size-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Tổng điểm yếu</p>
              <p className="text-[28px] font-bold text-gray-900">{summary.totalWeaknesses}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-14 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Users className="size-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">HS cần cải thiện</p>
              <p className="text-[28px] font-bold text-gray-900">{summary.totalStudents}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="size-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <BookOpen className="size-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Chủ đề yếu</p>
              <p className="text-[28px] font-bold text-gray-900">{summary.topics.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Topics section — Stitch style */}
      {summary && summary.topics.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Chủ đề cần lưu ý</h2>
              <p className="text-sm text-gray-500">Các chủ đề có nhiều học sinh gặp khó khăn</p>
            </div>
            <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
              {summary.topics.length} chủ đề ưu tiên
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {summary.topics.slice(0, 10).map((t, i) => {
              const maxErrors = Math.max(...summary.topics.map((x) => x.totalErrors), 1);
              const pct = Math.round((t.totalErrors / maxErrors) * 100);
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        <MathText text={t.topic} />
                      </p>
                      {t.lessonTitle && (
                        <p className="text-xs text-gray-400 mt-0.5">{t.lessonTitle}</p>
                      )}
                    </div>
                    {t.subjectName && (
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">{t.subjectName}</Badge>
                    )}
                  </div>
                  {/* Error bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-red-600 shrink-0">{t.totalErrors} lỗi</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Users className="size-3" />
                      <span>{t.studentCount} học sinh</span>
                    </div>
                    <Link
                      href={`/teacher/mistakes?topic=${encodeURIComponent(t.topic)}`}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <Sparkles className="size-3" />
                      Phân tích AI
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Students list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Học sinh có điểm yếu</h2>
            <p className="text-sm text-gray-500">Danh sách học sinh cần được hỗ trợ thêm</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm học sinh..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Users className="size-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">
              {search ? "Không tìm thấy học sinh" : "Không có học sinh nào có điểm yếu"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredStudents.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/mistakes/${s.id}`}
                className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {s.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{s.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {(s.weaknessCount || 0) > 0
                        ? `${s.weaknessCount} điểm yếu`
                        : "Không có điểm yếu"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.weaknessCount && s.weaknessCount > 0 && (
                    <span className="bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                      {s.weaknessCount}
                    </span>
                  )}
                  <ChevronRight className="size-4 text-gray-300 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
