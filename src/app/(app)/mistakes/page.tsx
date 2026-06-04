"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { MaterialIcon } from "@/components/ui/material-icon";
import { WeaknessSummary } from "@/components/ai/weakness-summary";

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

// ─── Quiz Panel per lesson (student) ───

function LessonQuizPanel({
  items,
  subjectName,
  lessonTitle,
  onClose,
}: {
  items: WeaknessProfile[];
  subjectName: string;
  lessonTitle: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; questions: any[]; error?: string }>({ loading: true, questions: [] });
  const [answering, setAnswering] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    api<{ questions: any[] }>("/api/ai/generate-weakness-quiz", {
      method: "POST",
      body: JSON.stringify({
        weaknesses: items.map((p) => ({ id: p.id, topic: p.topic })),
        subjectName,
        lessonTitle,
      }),
    })
      .then((data) => {
        if (!cancelled) setState({ loading: false, questions: data.questions.map((q: any) => ({ ...q, answered: false, correct: false })) });
      })
      .catch((e: any) => {
        if (!cancelled) setState({ loading: false, questions: [], error: e.message });
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (qIdx: number, weaknessId: string, selectedIdx: number, correctIdx: number) => {
    const key = `${qIdx}`;
    setAnswering((p) => ({ ...p, [key]: true }));
    const correct = selectedIdx === correctIdx;
    try {
      if (correct) await api(`/api/weaknesses/${weaknessId}/improve`, { method: "POST" });
    } catch { /* ignore */ }
    setState((prev) => {
      const updated = prev.questions.map((q: any, i: number) =>
        i === qIdx ? { ...q, answered: true, correct, selectedIdx } : q
      );
      return { ...prev, questions: updated };
    });
    setAnswering((p) => ({ ...p, [key]: false }));
  };

  if (state.loading) {
    return (
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" />
          AI đang tạo bài tập khắc phục...
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="px-6 py-4 border-t border-gray-100">
        <div className="text-sm text-red-600">Lỗi: {state.error}</div>
        <button className="text-xs text-primary underline mt-1" onClick={onClose}>Thử lại</button>
      </div>
    );
  }

  const answeredCount = state.questions.filter((q: any) => q.answered).length;
  const correctCount = state.questions.filter((q: any) => q.correct).length;

  return (
    <div className="border-t border-gray-100">
      <div className="px-6 py-3 flex items-center justify-between bg-gray-50/80">
        <div className="flex items-center gap-2">
          <MaterialIcon name="assignment" className="text-primary text-lg" />
          <span className="font-bold text-gray-700 text-sm">
            Bài tập khắc phục ({state.questions.length} câu)
          </span>
          {answeredCount > 0 && (
            <span className="text-xs text-gray-500">
              — {correctCount}/{answeredCount} đúng
            </span>
          )}
        </div>
        <button className="text-xs text-gray-400 hover:text-gray-600" onClick={onClose}>
          <MaterialIcon name="close" className="text-lg" />
        </button>
      </div>
      <div className="divide-y divide-gray-100">
        {state.questions.map((q: any, qIdx: number) => {
          const correctIdx = q.options?.findIndex((o: any) => o.isCorrect) ?? -1;
          return (
            <div key={q.id || qIdx} className={`px-6 py-4 ${q.answered ? (q.correct ? "bg-green-50/50" : "bg-red-50/50") : ""}`}>
              <div className="flex items-start gap-3">
                <MaterialIcon
                  name={q.answered ? (q.correct ? "check_circle" : "cancel") : "radio_button_unchecked"}
                  className={`text-xl shrink-0 mt-0.5 ${q.answered ? (q.correct ? "text-green-600" : "text-red-500") : "text-gray-400"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    <span className="text-gray-400 mr-2">#{qIdx + 1}</span>
                    <MathText text={q.question} />
                  </p>
                  <p className="text-xs text-pink-600 mb-2">
                    Khắc phục: <MathText text={q.weaknessTopic || ""} />
                  </p>
                  <div className="space-y-1">
                    {q.options?.map((opt: any, oIdx: number) => (
                      <button
                        key={oIdx}
                        disabled={q.answered || answering[`${qIdx}`]}
                        onClick={() => answer(qIdx, q.weaknessId, oIdx, correctIdx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          q.answered
                            ? oIdx === correctIdx
                              ? "bg-green-100 text-green-800 font-semibold"
                              : oIdx === q.selectedIdx
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-400"
                            : "bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-700"
                        }`}
                      >
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt.text}
                        {q.answered && oIdx === correctIdx && " ✓"}
                        {q.answered && oIdx === q.selectedIdx && oIdx !== correctIdx && " ✗"}
                      </button>
                    ))}
                  </div>
                  {q.answered && q.explanation && (
                    <p className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded-lg">
                      💡 <MathText text={q.explanation} />
                    </p>
                  )}
                  {q.answered && q.correct && (
                    <p className="mt-1 text-xs text-green-600 font-semibold">✅ Điểm yếu này đã được cải thiện!</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───

export default function MistakesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonContext, setLessonContext] = useState<Record<string, LessonContext>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [quizOpen, setQuizOpen] = useState<Record<string, boolean>>({});

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
        <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-2 leading-tight">
          Điểm yếu & Cải thiện
        </h1>
        <p className="text-base text-gray-500">Những chủ đề bạn cần ôn luyện thêm, gom theo môn học</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="verified" className="text-4xl text-green-400" />
          </div>
          <p className="text-lg font-semibold text-gray-500">Bạn chưa có điểm yếu nào được ghi nhận</p>
          <p className="text-sm text-gray-400 mt-1">Bạn đang làm rất tốt! Tiếp tục phát huy nhé.</p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
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
                          {lessons.size} bài học cần cải thiện
                        </p>
                      </div>
                    </div>
                    <MaterialIcon
                      name="expand_more"
                      className={`text-2xl text-gray-400 transition-transform duration-200 ${isSubjectCollapsed ? "" : "rotate-180"}`}
                    />
                  </button>

                  {/* Accordion Content */}
                  {!isSubjectCollapsed && (
                    <div className="border-t border-gray-100">
                      {[...lessons.entries()].map(([lessonId, items]) => {
                        const ctx = lessonContext[lessonId];
                        const lessonTitle = ctx?.lessonTitle || `#${lessonId.slice(0, 8)}`;
                        const activeItems = items.filter(p => !p.resolved);

                        return (
                          <div key={lessonId}>
                            {/* Lesson header bar */}
                            <div className="px-6 py-3 bg-gray-50/80 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-700 text-sm">{lessonTitle}</span>
                                <span className="bg-gray-200 text-gray-500 text-[11px] px-2 py-0.5 rounded-full font-medium">
                                  {items.length}
                                </span>
                              </div>
                              {activeItems.length > 0 && (
                                quizOpen[lessonId] ? (
                                  <button
                                    className="flex items-center gap-2 px-4 py-1.5 text-gray-400 hover:text-gray-600 rounded-full text-xs font-bold transition-colors"
                                    onClick={() => setQuizOpen((p) => ({ ...p, [lessonId]: false }))}
                                  >
                                    <MaterialIcon name="visibility_off" className="text-sm" />
                                    Ẩn bài tập
                                  </button>
                                ) : (
                                  <button
                                    className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-full text-xs font-bold hover:shadow-md transition-all active:scale-95"
                                    onClick={() => setQuizOpen((p) => ({ ...p, [lessonId]: true }))}
                                  >
                                    <MaterialIcon name="assignment_add" className="text-sm" />
                                    Tạo bài tập cho toàn bộ bài học
                                  </button>
                                )
                              )}
                            </div>

                            {/* Quiz panel */}
                            {quizOpen[lessonId] && activeItems.length > 0 && (
                              <LessonQuizPanel
                                items={activeItems}
                                subjectName={subjectName}
                                lessonTitle={lessonTitle}
                                onClose={() => setQuizOpen((p) => ({ ...p, [lessonId]: false }))}
                              />
                            )}

                            {/* Weakness items */}
                            <div className="divide-y divide-gray-100">
                              {items.map((p) => {
                                const src = p.source ? sourceConfig[p.source] : null;
                                return (
                                  <div
                                    key={p.id}
                                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 group hover:bg-gray-50/50 transition-colors"
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
                      {/* AI nhận xét cho toàn bộ môn học */}
                      <WeaknessSummary
                        topics={[...lessons.values()].flat().filter(p => !p.resolved).map(p => p.topic)}
                        subjectName={subjectName}
                      />
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
              <MaterialIcon name="task_alt" className="absolute -bottom-4 -right-4 text-9xl text-primary/10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="p-6 bg-pink-50 rounded-3xl flex flex-col justify-between overflow-hidden relative group">
              <div className="relative z-10">
                <h4 className="text-lg font-semibold text-pink-700/80 mb-2">Tổng lỗi</h4>
                <p className="text-4xl font-extrabold text-pink-700">{totalErrors}</p>
                <p className="text-xs text-pink-600/60 mt-1">Cần cải thiện thêm</p>
              </div>
              <MaterialIcon name="trending_up" className="absolute -bottom-4 -right-4 text-9xl text-pink-600/10 group-hover:scale-110 transition-transform" />
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
                  <MaterialIcon name="chat" className="text-sm mr-1.5" />
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
