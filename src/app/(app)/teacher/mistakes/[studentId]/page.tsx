"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
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

const sourceConfig: Record<string, { icon: string; label: string; color: string }> = {
  quiz: { icon: "help", label: "Quiz", color: "bg-blue-50 text-blue-700 border-blue-200" },
  exercise: { icon: "description", label: "Bài tập", color: "bg-purple-50 text-purple-700 border-purple-200" },
  profile: { icon: "person_check", label: "GV thiết lập", color: "bg-red-50 text-red-700 border-red-200" },
  progress: { icon: "schedule", label: "Kẹt bài", color: "bg-orange-50 text-orange-700 border-orange-200" },
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
  const [lessonQuiz, setLessonQuiz] = useState<Record<string, { loading: boolean; questions: any[]; error?: string }>>({});
  const [answering, setAnswering] = useState<Record<string, boolean>>({});

  const generateQuiz = async (lessonId: string, items: WeaknessProfile[]) => {
    setLessonQuiz((prev) => ({ ...prev, [lessonId]: { loading: true, questions: [] } }));
    try {
      const data = await api<{ questions: any[] }>("/api/ai/generate-weakness-quiz", {
        method: "POST",
        body: JSON.stringify({
          weaknesses: items.map((p) => ({ id: p.id, topic: p.topic })),
          subjectName: lessonContext[lessonId]?.subjectName || "",
          lessonTitle: lessonContext[lessonId]?.lessonTitle || "",
        }),
      });
      setLessonQuiz((prev) => ({ ...prev, [lessonId]: { loading: false, questions: data.questions.map((q: any) => ({ ...q, answered: false, correct: false })) } }));
    } catch (e: any) {
      setLessonQuiz((prev) => ({ ...prev, [lessonId]: { loading: false, questions: [], error: e.message } }));
    }
  };

  const answerQuestion = async (lessonId: string, qIdx: number, weaknessId: string, selectedIdx: number, correctIdx: number) => {
    const key = `${lessonId}-${qIdx}`;
    setAnswering((prev) => ({ ...prev, [key]: true }));
    const correct = selectedIdx === correctIdx;
    try {
      if (correct) {
        await api(`/api/weaknesses/${weaknessId}/improve`, { method: "POST" });
      }
      setLessonQuiz((prev) => {
        const quiz = prev[lessonId];
        if (!quiz) return prev;
        const updated = quiz.questions.map((q: any, i: number) =>
          i === qIdx ? { ...q, answered: true, correct, selectedIdx } : q
        );
        return { ...prev, [lessonId]: { ...quiz, questions: updated } };
      });
    } catch {
      // still mark as answered
      setLessonQuiz((prev) => {
        const quiz = prev[lessonId];
        if (!quiz) return prev;
        const updated = quiz.questions.map((q: any, i: number) =>
          i === qIdx ? { ...q, answered: true, correct, selectedIdx } : q
        );
        return { ...prev, [lessonId]: { ...quiz, questions: updated } };
      });
    } finally {
      setAnswering((prev) => ({ ...prev, [key]: false }));
    }
  };

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
        <MaterialIcon name="arrow_back" className="size-4" /> Quay lại danh sách
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
          <MaterialIcon name="trending_up" className="size-12 text-gray-300 mx-auto mb-4" />
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
                  <MaterialIcon name="menu_book" className="size-4 text-indigo-600 shrink-0" />
                  <h2 className="font-semibold text-gray-900 text-left">{subjectName}</h2>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {total} điểm yếu
                  </Badge>
                  <div className="flex-1" />
                  {isSubjectCollapsed ? (
                    <MaterialIcon name="expand_more" className="size-4 text-gray-400 shrink-0" />
                  ) : (
                    <MaterialIcon name="expand_less" className="size-4 text-gray-400 shrink-0" />
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
                                    <MaterialIcon name="check_circle" className="size-3.5 text-green-600 shrink-0" />
                                  ) : (
                                    <MaterialIcon name="error" className="size-3.5 text-amber-500 shrink-0" />
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
                                      <MaterialIcon name="trending_up" className="size-3 mr-0.5" />
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
                          {/* AI weakness summary per lesson */}
                          <LessonWeaknessSummary
                            topics={items.filter(p => !p.resolved).map(p => p.topic)}
                            subjectName={subjectName}
                            lessonTitle={lessonTitle}
                          />

                          {/* Generate remediation quiz button */}
                          <div className="px-4 py-2 border-t border-gray-100">
                            {!lessonQuiz[lessonId] ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                onClick={() => generateQuiz(lessonId, items.filter(p => !p.resolved))}
                              >
                                <MaterialIcon name="auto_awesome" className="size-3.5" />
                                Tạo bài tập khắc phục ({items.filter(p => !p.resolved).length} câu)
                              </Button>
                            ) : lessonQuiz[lessonId].loading ? (
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <Loader2 className="size-3 animate-spin" />
                                AI đang tạo bài tập...
                              </div>
                            ) : lessonQuiz[lessonId].error ? (
                              <div className="text-xs text-red-500">
                                Lỗi: {lessonQuiz[lessonId].error}
                                <button
                                  className="ml-2 underline hover:text-red-700"
                                  onClick={() => setLessonQuiz((prev) => { const next = { ...prev }; delete next[lessonId]; return next; })}
                                >
                                  Thử lại
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-indigo-700">
                                    📝 Bài tập khắc phục ({lessonQuiz[lessonId].questions.length} câu)
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    — Mỗi câu tương ứng 1 điểm yếu
                                  </span>
                                </div>
                                {lessonQuiz[lessonId].questions.map((q: any, qIdx: number) => {
                                  const correctIdx = q.options?.findIndex((o: any) => o.isCorrect) ?? -1;
                                  const key = `${lessonId}-${qIdx}`;
                                  return (
                                    <div
                                      key={q.id || qIdx}
                                      className={`p-3 rounded-lg border text-sm ${
                                        q.answered
                                          ? q.correct
                                            ? "bg-green-50 border-green-200"
                                            : "bg-red-50 border-red-200"
                                          : "bg-white border-gray-200"
                                      }`}
                                    >
                                      <div className="flex items-start gap-2 mb-2">
                                        <span className="text-xs font-bold text-gray-400 shrink-0 mt-0.5">
                                          #{qIdx + 1}
                                        </span>
                                        <div className="flex-1">
                                          <p className="font-medium text-gray-900">
                                            <MathText text={q.question} />
                                          </p>
                                          <p className="text-xs text-purple-500 mt-0.5">
                                            Khắc phục: <MathText text={q.weaknessTopic || ""} />
                                          </p>
                                        </div>
                                      </div>
                                      <div className="ml-5 space-y-1">
                                        {q.options?.map((opt: any, oIdx: number) => (
                                          <button
                                            key={oIdx}
                                            disabled={q.answered || answering[key]}
                                            onClick={() => answerQuestion(lessonId, qIdx, q.weaknessId, oIdx, correctIdx)}
                                            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                                              q.answered
                                                ? oIdx === correctIdx
                                                  ? "bg-green-100 text-green-800 font-semibold"
                                                  : oIdx === q.selectedIdx
                                                    ? "bg-red-100 text-red-800"
                                                    : "bg-gray-50 text-gray-400"
                                                : "bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700"
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
                                        <div className="ml-5 mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                                          💡 <MathText text={q.explanation} />
                                        </div>
                                      )}
                                      {q.answered && q.correct && (
                                        <div className="ml-5 mt-1 text-xs text-green-600 font-medium">
                                          ✅ Điểm yếu này đã được cải thiện!
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-gray-400"
                                  onClick={() => setLessonQuiz((prev) => { const next = { ...prev }; delete next[lessonId]; return next; })}
                                >
                                  Ẩn bài tập
                                </Button>
                              </div>
                            )}
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

// LessonWeaknessSummary calls AI to summarize weaknesses for a specific lesson
function LessonWeaknessSummary({
  topics,
  subjectName,
  lessonTitle,
}: {
  topics: string[];
  subjectName: string;
  lessonTitle: string;
}) {
  const [result, setResult] = useState<{ loading: boolean; summary: string | null }>({
    loading: topics.length > 0,
    summary: null,
  });

  useEffect(() => {
    if (topics.length === 0) return;
    let cancelled = false;
    api<{ summary: string }>("/api/ai/summarize-weaknesses", {
      method: "POST",
      body: JSON.stringify({ topics, subjectName, lessonTitle }),
    })
      .then((data) => { if (!cancelled) setResult({ loading: false, summary: data.summary }); })
      .catch(() => { if (!cancelled) setResult({ loading: false, summary: null }); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (topics.length === 0) return null;

  return (
    <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 border-t border-indigo-100">
      {result.loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="size-3 animate-spin" />
          AI đang phân tích điểm yếu...
        </div>
      ) : result.summary ? (
        <div className="text-xs text-gray-700 leading-relaxed">
          <span className="font-semibold text-indigo-700">🤖 AI nhận xét: </span>
          {result.summary}
        </div>
      ) : null}
    </div>
  );
}
