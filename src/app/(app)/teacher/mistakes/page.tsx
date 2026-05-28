"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, BookOpen, AlertCircle, Users, ChevronRight, Search, BarChart3 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <div className="animate-fade-in max-w-5xl">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lí điểm yếu</h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi và khắc phục điểm yếu của học sinh trong lớp
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-red-100">
                <AlertCircle className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalWeaknesses}</p>
                <p className="text-xs text-gray-500">Tổng điểm yếu</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-amber-100">
                <TrendingUp className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalStudents}</p>
                <p className="text-xs text-gray-500">Học sinh cần cải thiện</p>
              </div>
            </div>
          </Card>
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100">
                <BookOpen className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{summary.topics.length}</p>
                <p className="text-xs text-gray-500">Chủ đề yếu</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Topics section */}
      {summary && summary.topics.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 className="size-5 text-indigo-600" />
            Chủ đề nổi bật
          </h2>
          <div className="space-y-2">
            {summary.topics.slice(0, 10).map((t, i) => (
              <Card
                key={i}
                className="rounded-xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      <MathText text={t.topic} />
                    </p>
                    {t.lessonTitle && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.lessonTitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <Badge variant="destructive" className="text-xs">
                      {t.totalErrors} lỗi
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {t.studentCount} HS
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Students list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="size-5 text-emerald-600" />
            Học sinh có điểm yếu
          </h2>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm học sinh..."
            className="pl-9"
          />
        </div>

        {filteredStudents.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border">
            <Users className="size-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {search ? "Không tìm thấy học sinh" : "Không có học sinh nào có điểm yếu"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((s) => (
              <Link
                key={s.id}
                href={`/teacher/mistakes/${s.id}`}
                className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center size-10 rounded-full bg-amber-100 text-amber-600 font-bold text-sm">
                    {s.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{s.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {(s.weaknessCount || 0) > 0
                        ? `${s.weaknessCount} điểm yếu cần khắc phục`
                        : "Không có điểm yếu"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {s.weaknessCount && s.weaknessCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {s.weaknessCount}
                    </Badge>
                  )}
                  <ChevronRight className="size-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
