"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, TrendingUp, BookOpen, CheckCircle, HelpCircle, FileText, UserCheck, Clock, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";

interface WeaknessProfile {
  id: string;
  userId: string;
  lessonId: string;
  topic: string;
  source: string;
  weight: number;
  errorCount: number;
  quizAttempts: number;
  quizCorrect: number;
  lastErrorAt: string | null;
  remediationExercises: string;
  improvementScore: number;
  resolved: boolean;
  resolvedAt: string | null;
  coachNotes: string;
}

interface LessonContext {
  subjectName: string;
  lessonTitle: string;
  description: string;
  gradeLevel: number;
}

const sourceConfig: Record<string, { icon: typeof HelpCircle; label: string; color: string }> = {
  quiz: { icon: HelpCircle, label: "Quiz", color: "bg-blue-50 text-blue-700 border-blue-200" },
  exercise: { icon: FileText, label: "Bài tập", color: "bg-purple-50 text-purple-700 border-purple-200" },
  profile: { icon: UserCheck, label: "GV thiết lập", color: "bg-red-50 text-red-700 border-red-200" },
  progress: { icon: Clock, label: "Kẹt bài", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

export default function TeacherStudentMistakesPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonContext, setLessonContext] = useState<Record<string, LessonContext>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      api<WeaknessProfile[]>(`/api/weaknesses?userId=${studentId}`),
      api<{ fullName: string }>(`/api/users/${studentId}`).catch(() => null),
    ])
      .then(async ([data, user]) => {
        const active = data.filter((p) => !p.resolved);
        setProfiles(active);
        if (user) setStudentName(user.fullName);

        const uniqueLessonIds = [...new Set(data.map((p) => p.lessonId).filter(Boolean))];
        const map: Record<string, LessonContext> = {};
        await Promise.all(
          uniqueLessonIds.map((lid) =>
            api<LessonContext>(`/api/lessons/${lid}/context`)
              .then((ctx) => { map[lid] = ctx; })
              .catch(() => { map[lid] = { subjectName: "Không rõ", lessonTitle: `#${lid.slice(0, 8)}`, description: "", gradeLevel: 0 }; })
          )
        );
        setLessonContext(map);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group by subject → lessonId → weaknesses
  const bySubject = new Map<string, Map<string, WeaknessProfile[]>>();
  for (const p of profiles) {
    const ctx = lessonContext[p.lessonId];
    const subject = ctx?.subjectName || "Không rõ";
    const lesson = p.lessonId || "__unknown__";
    if (!bySubject.has(subject)) bySubject.set(subject, new Map());
    const lessons = bySubject.get(subject)!;
    if (!lessons.has(lesson)) lessons.set(lesson, []);
    lessons.get(lesson)!.push(p);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={80} className="h-6 w-64" />
        {[1, 2, 3].map((i) => <Skeleton key={i} delay={80 + i * 100} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link
        href="/teacher/mistakes"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại danh sách
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Điểm yếu{studentName ? ` — ${studentName}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {profiles.length} điểm yếu đang hoạt động
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <TrendingUp className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Học sinh này không có điểm yếu nào đang hoạt động</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...bySubject.entries()].map(([subjectName, lessons]) => {
            const subjectKey = subjectName;
            const isSubjectCollapsed = collapsed[subjectKey] || false;
            const total = [...lessons.values()].flat().length;

            return (
              <div key={subjectKey} className="bg-white rounded-lg border">
                <button
                  onClick={() => toggleCollapse(subjectKey)}
                  className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-gray-50 transition-colors rounded-lg"
                >
                  <BookOpen className="size-4 text-indigo-600 shrink-0" />
                  <h2 className="font-semibold text-gray-900 text-left">{subjectName}</h2>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {total} điểm yếu
                  </Badge>
                  <div className="flex-1" />
                  {isSubjectCollapsed ? (
                    <ChevronDown className="size-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronUp className="size-4 text-gray-400 shrink-0" />
                  )}
                </button>

                {!isSubjectCollapsed && (
                  <div className="border-t">
                    {[...lessons.entries()].map(([lessonId, items]) => {
                      const ctx = lessonContext[lessonId];
                      const lessonTitle = ctx?.lessonTitle || `#${lessonId.slice(0, 8)}`;

                      return (
                        <div key={lessonId}>
                          <div className="px-4 py-1.5 bg-gray-50/80 flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">{lessonTitle}</span>
                            <Badge variant="outline" className="text-xs py-0 text-gray-400">{items.length}</Badge>
                          </div>

                          <div className="divide-y">
                            {items.map((p) => (
                              <div key={p.id} className={`px-4 py-2.5 ${p.resolved ? "bg-green-50/30" : ""}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {p.resolved ? (
                                    <CheckCircle className="size-3.5 text-green-600 shrink-0" />
                                  ) : (
                                    <AlertCircle className="size-3.5 text-amber-500 shrink-0" />
                                  )}
                                  <span className={`font-medium text-sm ${p.resolved ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                    <MathText text={p.topic} />
                                  </span>
                                  <Badge variant="destructive" className="text-xs py-0">
                                    {p.errorCount} lần
                                  </Badge>
                                  {p.source && sourceConfig[p.source] && (
                                    <Badge variant="outline" className={`text-xs py-0 ${sourceConfig[p.source].color}`}>
                                      {sourceConfig[p.source].label}
                                    </Badge>
                                  )}
                                  {p.weight > 0 && (
                                    <Badge variant="outline" className="text-xs py-0 bg-gray-50 text-gray-600 border-gray-200">
                                      {p.weight.toFixed(1)}đ
                                    </Badge>
                                  )}
                                  {p.improvementScore > 0 && (
                                    <Badge variant="outline" className="text-xs py-0">
                                      <TrendingUp className="size-3 mr-0.5" />
                                      {p.improvementScore}
                                    </Badge>
                                  )}
                                  {p.lastErrorAt && (
                                    <span className="text-xs text-gray-400">
                                      {new Date(p.lastErrorAt).toLocaleDateString("vi-VN")}
                                    </span>
                                  )}
                                </div>
                                {p.coachNotes && (
                                  <div className="mt-1.5 ml-5 p-2 bg-blue-50 rounded text-sm text-blue-700">
                                    <span className="font-medium">Ghi chú:</span> <MathText text={p.coachNotes} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
