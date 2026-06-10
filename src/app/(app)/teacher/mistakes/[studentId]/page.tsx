"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { MaterialIcon } from "@/components/ui/material-icon";
import { WeaknessSummary } from "@/components/ai/weakness-summary";
import type { WeaknessQuestion, WeaknessOption } from "@/components/ai/weakness-quiz-panel";

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

const sourceConfig: Record<string, { icon: string; label: string; color: string }> = {
  quiz: { icon: "help", label: "Quiz", color: "bg-blue-50 text-blue-700 border-blue-200" },
  exercise: { icon: "description", label: "Bài tập", color: "bg-purple-50 text-purple-700 border-purple-200" },
  profile: { icon: "person_check", label: "GV thiết lập", color: "bg-red-50 text-red-700 border-red-200" },
  progress: { icon: "schedule", label: "Kẹt bài", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

// ─── Quiz Panel per lesson (tối giản – hiện khi bấm nút tạo bài tập) ───

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
  const [state, setState] = useState<{ loading: boolean; questions: WeaknessQuestion[]; error?: string }>({ loading: true, questions: [] });
  const [answering, setAnswering] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    api<{ questions: WeaknessQuestion[] }>("/api/ai/generate-weakness-quiz", {
      method: "POST",
      body: JSON.stringify({
        weaknesses: items.map((p) => ({ id: p.id, topic: p.topic })),
        subjectName,
        lessonTitle,
      }),
    })
      .then((data) => {
        if (!cancelled) setState({ loading: false, questions: data.questions.map((q: WeaknessQuestion) => ({ ...q, answered: false, correct: false })) });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ loading: false, questions: [], error: e.message });
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = async (qIdx: number, weaknessId: string | undefined, selectedIdx: number, correctIdx: number) => {
    const key = `${qIdx}`;
    setAnswering((p) => ({ ...p, [key]: true }));
    const correct = selectedIdx === correctIdx;
    try {
      if (correct && weaknessId) await api(`/api/weaknesses/${weaknessId}/improve`, { method: "POST" });
    } catch { /* ignore */ }
    setState((prev) => {
      const updated = prev.questions.map((q: WeaknessQuestion, i: number) =>
        i === qIdx ? { ...q, answered: true, correct, selectedIdx } : q
      );
      return { ...prev, questions: updated };
    });
    setAnswering((p) => ({ ...p, [key]: false }));
  };

  if (state.loading) {
    return (
      <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Loader2 className="size-4 animate-spin" />
          AI đang tạo bài tập khắc phục...
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest">
        <div className="text-sm text-error">Lỗi: {state.error}</div>
        <button className="text-xs text-primary underline mt-1" onClick={onClose}>Thử lại</button>
      </div>
    );
  }

  const answeredCount = state.questions.filter((q: WeaknessQuestion) => q.answered).length;
  const correctCount = state.questions.filter((q: WeaknessQuestion) => q.correct).length;

  return (
    <div className="border-t border-outline-variant bg-surface-container-lowest">
      <div className="px-6 py-3 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">assignment</span>
          <span className="font-bold text-on-surface-variant text-sm">
            Bài tập khắc phục ({state.questions.length} câu)
          </span>
          {answeredCount > 0 && (
            <span className="text-xs text-on-surface-variant">
              — {correctCount}/{answeredCount} đúng
            </span>
          )}
        </div>
        <button className="text-xs text-outline hover:text-on-surface" onClick={onClose}>
          <MaterialIcon name="close" className="text-lg" />
        </button>
      </div>
      <div className="divide-y divide-outline-variant">
        {state.questions.map((q: WeaknessQuestion, qIdx: number) => {
          const correctIdx = q.options?.findIndex((o: WeaknessOption) => o.isCorrect) ?? -1;
          return (
            <div key={q.id || qIdx} className={`px-6 py-4 ${q.answered ? (q.correct ? "bg-tertiary-fixed/30" : "bg-error-container/30") : ""}`}>
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${q.answered ? (q.correct ? "text-tertiary" : "text-error") : "text-outline"}`}>
                  {q.answered ? (q.correct ? "check_circle" : "cancel") : "radio_button_unchecked"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface mb-1">
                    <span className="text-outline mr-2">#{qIdx + 1}</span>
                    <MathText text={q.question} />
                  </p>
                  <p className="text-xs text-secondary mb-2">
                    Khắc phục: <MathText text={q.weaknessTopic || ""} />
                  </p>
                  <div className="space-y-1">
                    {q.options?.map((opt: WeaknessOption, oIdx: number) => (
                      <button
                        key={oIdx}
                        disabled={q.answered || answering[`${qIdx}`]}
                        onClick={() => answer(qIdx, q.weaknessId, oIdx, correctIdx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          q.answered
                            ? oIdx === correctIdx
                              ? "bg-tertiary-fixed text-on-tertiary-fixed-variant font-semibold"
                              : oIdx === q.selectedIdx
                                ? "bg-error-container text-on-error-container"
                                : "bg-surface-container-low text-outline"
                            : "bg-surface-container-low hover:bg-primary-fixed text-on-surface hover:text-on-primary-fixed"
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
                    <p className="mt-2 text-xs text-on-surface-variant bg-surface-container p-2 rounded-lg">
                      💡 <MathText text={q.explanation} />
                    </p>
                  )}
                  {q.answered && q.correct && (
                    <p className="mt-1 text-xs text-tertiary font-semibold">✅ Điểm yếu này đã được cải thiện!</p>
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
  const [quizOpen, setQuizOpen] = useState<Record<string, boolean>>({});

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
      {/* Back link */}
      <Link
        href="/teacher/mistakes"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors mb-4"
      >
        <MaterialIcon name="arrow_back" className="text-lg" />
        Quay lại danh sách
      </Link>

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-bold text-[32px] tracking-[-0.02em] text-on-surface mb-2 leading-tight">
          Điểm yếu{studentName ? ` — ${studentName}` : ""}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          {profiles.length} điểm yếu đang hoạt động
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-container rounded-lg text-sm text-on-error-container">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-24 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl text-outline">trending_up</span>
          </div>
          <p className="text-on-surface-variant text-lg">Học sinh này không có điểm yếu nào đang hoạt động</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...bySubject.entries()].map(([subjectName, lessons]) => {
            const subjectKey = subjectName;
            const isCollapsed = collapsed[subjectKey] || false;
            const total = [...lessons.values()].flat().length;

            return (
              <div key={subjectKey} className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
                {/* Subject accordion header */}
                <button
                  onClick={() => toggleCollapse(subjectKey)}
                  className="w-full p-6 flex items-center justify-between hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl">menu_book</span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg text-on-surface flex items-center gap-3">
                        {subjectName}
                        <span className="bg-error-container text-on-error-container text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {total} điểm yếu
                        </span>
                      </h3>
                      <p className="text-sm text-on-surface-variant">
                        {lessons.size} bài học cần cải thiện
                      </p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-outline transition-transform ${isCollapsed ? "" : "rotate-180"}`}>
                    expand_more
                  </span>
                </button>

                {/* Accordion content */}
                {!isCollapsed && (
                  <div className="border-t border-outline-variant">
                    {[...lessons.entries()].map(([lessonId, items]) => {
                      const ctx = lessonContext[lessonId];
                      const lessonTitle = ctx?.lessonTitle || `#${lessonId.slice(0, 8)}`;
                      const activeItems = items.filter(p => !p.resolved);

                      return (
                        <div key={lessonId} className="bg-surface-container-lowest">
                          {/* Lesson header bar */}
                          <div className="px-6 py-3 bg-surface-container-low flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-on-surface-variant text-sm">{lessonTitle}</span>
                              <span className="bg-surface-variant text-on-surface-variant text-[11px] px-2 py-0.5 rounded-full">{activeItems.length}</span>
                            </div>
                            {activeItems.length > 0 && (
                              quizOpen[lessonId] ? (
                                <button
                                  className="flex items-center gap-2 px-4 py-1.5 text-outline hover:text-on-surface rounded-full text-xs font-bold transition-colors"
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
                                  <span className="material-symbols-outlined text-sm">assignment_add</span>
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
                          <div className="divide-y divide-outline-variant">
                            {items.map((p) => (
                              <div key={p.id} className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 group hover:bg-surface-bright transition-all ${p.resolved ? "opacity-50" : ""}`}>
                                <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                                  <span
                                    className={`material-symbols-outlined text-xl shrink-0 ${p.resolved ? "text-tertiary" : "text-error"}`}
                                    style={p.resolved ? { fontVariationSettings: "'FILL' 1" } : { fontVariationSettings: "'FILL' 1" }}
                                  >
                                    error
                                  </span>
                                  <div>
                                    <p className={`text-sm font-medium ${p.resolved ? "text-outline line-through" : "text-on-surface"}`}>
                                      <MathText text={p.topic} />
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                      <span className="bg-error-container text-on-error-container text-[11px] px-2 py-0.5 rounded-md font-bold">
                                        {p.errorCount} lần
                                      </span>
                                      {p.source && sourceConfig[p.source] && (
                                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${sourceConfig[p.source].color}`}>
                                          {sourceConfig[p.source].label}
                                        </span>
                                      )}
                                      <span className="bg-surface-container text-on-surface-variant text-[11px] px-2 py-0.5 rounded-md">
                                        {p.weight.toFixed(1)}đ
                                      </span>
                                      {p.lastErrorAt && (
                                        <span className="text-[11px] text-outline">
                                          {new Date(p.lastErrorAt).toLocaleDateString("vi-VN")}
                                        </span>
                                      )}
                                    </div>
                                    {p.coachNotes && (
                                      <div className="mt-2 p-2 bg-surface-container rounded text-xs text-on-surface-variant">
                                        <span className="font-medium">Ghi chú:</span> <MathText text={p.coachNotes} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {!p.resolved && (
                                  <button
                                    className="flex items-center gap-1.5 text-tertiary font-bold text-sm hover:underline shrink-0"
                                    onClick={async () => {
                                      try {
                                        await api(`/api/weaknesses/${p.id}/improve`, { method: "POST" });
                                        setProfiles((prev) =>
                                          prev.map((w) => (w.id === p.id ? { ...w, improvementScore: w.improvementScore + 1 } : w))
                                        );
                                      } catch { /* ignore */ }
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-lg">check_circle</span>
                                    Đã hiểu
                                  </button>
                                )}
                              </div>
                            ))}
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
      )}
    </div>
  );
}
