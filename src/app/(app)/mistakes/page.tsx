"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, CheckCircle, ChevronDown, Loader2, MessageCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { MaterialIcon } from "@/components/ui/material-icon";

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

const sourceConfig: Record<string, { label: string; color: string }> = {
  quiz: { label: "Quiz", color: "bg-blue-50 text-blue-700" },
  exercise: { label: "Bài tập", color: "bg-purple-50 text-purple-700" },
  profile: { label: "GV thiết lập", color: "bg-red-50 text-red-700" },
  progress: { label: "Kẹt bài", color: "bg-orange-50 text-orange-700" },
};

function getSubjectColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("toán")) return "bg-blue-100 text-blue-600";
  if (lower.includes("văn") || lower.includes("việt")) return "bg-pink-100 text-pink-600";
  if (lower.includes("anh")) return "bg-emerald-100 text-emerald-600";
  if (lower.includes("lý")) return "bg-purple-100 text-purple-600";
  if (lower.includes("hóa")) return "bg-indigo-100 text-indigo-600";
  if (lower.includes("sinh")) return "bg-teal-100 text-teal-600";
  return "bg-amber-100 text-amber-600";
}

function getSubjectIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("toán")) return "functions";
  if (lower.includes("văn") || lower.includes("việt")) return "menu_book";
  if (lower.includes("anh")) return "translate";
  if (lower.includes("lý")) return "bolt";
  if (lower.includes("hóa")) return "science";
  if (lower.includes("sinh")) return "biotech";
  return "book_4";
}

export default function MistakesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonContext, setLessonContext] = useState<Record<string, LessonContext>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  useEffect(() => {
    api<WeaknessProfile[]>("/api/weaknesses")
      .then(async (data) => {
        const active = data.filter((p) => !p.resolved);
        setProfiles(active);

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
  }, []);

  const handleResolve = async (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    try {
      await api(`/api/weaknesses/${id}/resolve`, { method: "POST" });
    } catch {
      api<WeaknessProfile[]>("/api/weaknesses")
        .then((data) => setProfiles(data.filter((p) => !p.resolved)))
        .catch(() => {});
    }
  };

  const handleGenerateExercise = async (p: WeaknessProfile) => {
    setGeneratingId(p.id);
    try {
      const result = await api<{
        exercises: { type: string; question: string }[];
        weaknessId: string;
        topic: string;
        subjectId: string;
        gradeLevel: number;
      }>("/api/ai/remediation", {
        method: "POST",
        body: JSON.stringify({ weaknessId: p.id }),
      });

      const newAssignment = await api<{ id: string }>("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: `Ôn tập: ${result.topic}`,
          description: JSON.stringify(result.exercises),
          source: "weakness",
          subjectId: result.subjectId,
          gradeLevel: result.gradeLevel,
          maxScore: 10,
        }),
      });

      router.push(`/assignments/${newAssignment.id}?weaknessId=${result.weaknessId}`);
    } catch {
      // Error is handled silently — user can retry
    } finally {
      setGeneratingId(null);
    }
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group: subjectName → lessonId → weaknesses
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
        {[1, 2, 3].map((i) => <Skeleton key={i} delay={80 + i * 100} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  const resolvedCount = profiles.filter((p) => p.resolved).length || 0;
  const totalErrors = profiles.reduce((s, p) => s + p.errorCount, 0);

  return (
    <div className="animate-fade-in max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-2">
          Điểm yếu & Cải thiện
        </h1>
        <p className="text-base text-gray-500">Những chủ đề bạn cần ôn luyện thêm, gom theo môn học</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="verified" className="text-4xl text-green-400" />
          </div>
          <p className="text-lg font-semibold text-gray-500">Bạn chưa có điểm yếu nào được ghi nhận</p>
          <p className="text-sm text-gray-400 mt-1">Bạn đang làm rất tốt! Tiếp tục phát huy nhé.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {[...bySubject.entries()].map(([subjectName, lessons]) => {
              const subjectKey = subjectName;
              const isSubjectCollapsed = collapsed[subjectKey] || false;
              const total = [...lessons.values()].flat().length;
              const iconColor = getSubjectColor(subjectName);
              const iconName = getSubjectIcon(subjectName);

              return (
                <div key={subjectKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Subject Header — Accordion trigger */}
                  <button
                    onClick={() => toggleCollapse(subjectKey)}
                    className="w-full p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconColor}`}>
                        <MaterialIcon name={iconName} className="text-2xl" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                          {subjectName}
                          <span className="bg-red-50 text-red-700 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            {total} điểm yếu
                          </span>
                        </h3>
                        <p className="text-sm text-gray-500">
                          {[...lessons.entries()].length} bài học cần cải thiện
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`size-5 text-gray-400 transition-transform duration-200 ${
                        isSubjectCollapsed ? "" : "rotate-180"
                      }`}
                    />
                  </button>

                  {/* Accordion Content */}
                  {!isSubjectCollapsed && (
                    <div className="border-t border-gray-100">
                      {[...lessons.entries()].map(([lessonId, items]) => {
                        const ctx = lessonContext[lessonId];
                        const lessonTitle = ctx?.lessonTitle || `#${lessonId.slice(0, 8)}`;

                        return (
                          <div key={lessonId}>
                            {/* Lesson group header */}
                            <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
                              <span className="font-bold text-gray-700 text-sm">{lessonTitle}</span>
                              <span className="bg-gray-200 text-gray-500 text-[11px] px-2 py-0.5 rounded-full font-medium">
                                {items.length}
                              </span>
                            </div>

                            {/* Error items */}
                            <div className="divide-y divide-gray-100">
                              {items.map((p) => {
                                const src = p.source ? sourceConfig[p.source] : null;
                                return (
                                  <div
                                    key={p.id}
                                    className="px-8 py-4 flex flex-wrap items-center justify-between gap-4 group hover:bg-gray-50/50 transition-colors"
                                  >
                                    <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                                      <MaterialIcon
                                        name="error"
                                        filled
                                        className={p.resolved ? "text-green-500 text-xl" : "text-red-500 text-xl"}
                                      />
                                      <div>
                                        <p className={`text-sm font-medium ${p.resolved ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                          <MathText text={p.topic} />
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                          <span className="bg-red-50 text-red-700 text-[11px] px-2 py-0.5 rounded-md font-bold">
                                            {p.errorCount} lần
                                          </span>
                                          {src && (
                                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${src.color}`}>
                                              {src.label}
                                            </span>
                                          )}
                                          {p.weight > 0 && (
                                            <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-md">
                                              {p.weight.toFixed(1)}đ
                                            </span>
                                          )}
                                          {p.lastErrorAt && (
                                            <span className="text-[11px] text-gray-400">
                                              {new Date(p.lastErrorAt).toLocaleDateString("vi-VN")}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    {!p.resolved && (
                                      <div className="flex items-center gap-3">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleGenerateExercise(p)}
                                          disabled={generatingId === p.id}
                                          className="text-xs text-primary font-bold hover:text-primary/80 hover:bg-primary/5 h-8 px-3"
                                        >
                                          {generatingId === p.id ? (
                                            <Loader2 className="size-3.5 mr-1 animate-spin" />
                                          ) : (
                                            <MaterialIcon name="link" className="text-base mr-1" />
                                          )}
                                          Tạo bài tập
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleResolve(p.id)}
                                          className="text-xs text-emerald-600 font-bold hover:text-emerald-700 hover:bg-emerald-50 h-8 px-3"
                                        >
                                          <MaterialIcon name="check_circle" className="text-base mr-1" />
                                          Đã hiểu
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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

          {/* Stats Bento */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-primary/10 rounded-3xl flex flex-col justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <h4 className="text-lg font-semibold text-primary/80 mb-2">Đã giải quyết</h4>
                <p className="text-4xl font-extrabold text-primary">{resolvedCount}</p>
                <p className="text-xs text-primary/60 mt-1">Lỗi sai được xử lý</p>
              </div>
              <CheckCircle className="absolute -bottom-4 -right-4 size-32 text-primary/10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="p-6 bg-pink-50 rounded-3xl flex flex-col justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <h4 className="text-lg font-semibold text-pink-700/80 mb-2">Tổng lỗi</h4>
                <p className="text-4xl font-extrabold text-pink-700">{totalErrors}</p>
                <p className="text-xs text-pink-600/60 mt-1">Cần cải thiện thêm</p>
              </div>
              <TrendingUp className="absolute -bottom-4 -right-4 size-32 text-pink-600/10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="bg-white border border-gray-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm">
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Cần hỗ trợ?</h4>
                <p className="text-sm text-gray-500 mb-4">Kết nối với giáo viên để trao đổi về các bài tập khó.</p>
                <Button
                  size="sm"
                  className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-full hover:shadow-lg"
                  onClick={() => router.push("/messages")}
                >
                  <MessageCircle className="size-3.5 mr-1.5" />
                  Gửi tin nhắn
                </Button>
              </div>
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center shrink-0">
                <MaterialIcon name="school" className="text-4xl text-gray-400" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
