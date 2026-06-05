"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { MaterialIcon } from "@/components/ui/material-icon";
import { WeaknessSummary } from "@/components/ai/weakness-summary";
import { WeaknessQuizPanel } from "@/components/ai/weakness-quiz-panel";

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
}

interface LessonContext {
  subjectName: string;
  lessonTitle: string;
  description: string;
  gradeLevel: number;
}

const sourceConfig: Record<string, { icon: string; label: string }> = {
  quiz: { icon: "help", label: "Quiz" },
  exercise: { icon: "description", label: "Bài tập" },
  profile: { icon: "person_check", label: "GV đánh giá" },
  progress: { icon: "schedule", label: "Kẹt bài" },
};

export default function StudentMistakesPage() {
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lessonContext, setLessonContext] = useState<Record<string, LessonContext>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [quizOpen, setQuizOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api<WeaknessProfile[]>("/api/weaknesses")
      .then(async (data) => {
        const active = (data || []).filter((p) => !p.resolved);
        setProfiles(active);

        const uniqueLessonIds = [...new Set(active.map((p) => p.lessonId).filter(Boolean))];
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
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImprove = async (id: string) => {
    try {
      await api(`/api/weaknesses/${id}/improve`, { method: "POST" });
      setProfiles((prev) =>
        prev.map((w) => (w.id === id ? { ...w, improvementScore: w.improvementScore + 1 } : w))
      );
    } catch { /* ignore */ }
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
        <Skeleton delay={0} className="h-8 w-64" />
        <Skeleton delay={80} className="h-6 w-96" />
        {[1, 2, 3].map((i) => <Skeleton key={i} delay={80 + i * 100} className="h-24 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-bold text-[32px] tracking-[-0.02em] text-gray-900 mb-2 leading-tight">
          Điểm yếu của em
        </h1>
        <p className="text-base text-gray-500">
          {profiles.length > 0
            ? `${profiles.length} điểm yếu đang hoạt động — luyện tập để khắc phục nhé!`
            : "Theo dõi và khắc phục các điểm yếu trong học tập"}
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="trending_up" className="text-4xl text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Không có điểm yếu nào</h3>
          <p className="text-gray-500">
            Em chưa có điểm yếu nào được ghi nhận. Hãy tiếp tục học tập chăm chỉ!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...bySubject.entries()].map(([subjectName, lessons]) => {
            const subjectKey = subjectName;
            const isCollapsed = collapsed[subjectKey] || false;
            const totalActive = [...lessons.values()].flat().filter((p) => !p.resolved).length;

            return (
              <div key={subjectKey} className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Subject accordion header */}
                <button
                  onClick={() => toggleCollapse(subjectKey)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <MaterialIcon name="menu_book" className="text-3xl" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-3">
                        {subjectName}
                        <span className="bg-red-100 text-red-700 text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          {totalActive} điểm yếu
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500">
                        {lessons.size} bài học cần cải thiện
                      </p>
                    </div>
                  </div>
                  <MaterialIcon
                    name="expand_more"
                    className={`text-gray-400 transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                  />
                </button>

                {/* Accordion content */}
                {!isCollapsed && (
                  <div className="border-t border-gray-100">
                    {[...lessons.entries()].map(([lessonId, items]) => {
                      const ctx = lessonContext[lessonId];
                      const lessonTitle = ctx?.lessonTitle || `#${lessonId.slice(0, 8)}`;
                      const activeItems = items.filter((p) => !p.resolved);

                      return (
                        <div key={lessonId} className="bg-gray-50/50">
                          {/* Lesson header bar */}
                          <div className="px-6 py-3 bg-gray-100/60 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-700 text-sm">{lessonTitle}</span>
                              <span className="bg-white text-gray-500 text-[11px] px-2 py-0.5 rounded-full border">
                                {activeItems.length}
                              </span>
                            </div>
                            {activeItems.length > 0 && (
                              quizOpen[lessonId] ? (
                                <button
                                  className="flex items-center gap-1.5 px-4 py-1.5 text-gray-400 hover:text-gray-600 rounded-full text-xs font-bold transition-colors"
                                  onClick={() => setQuizOpen((p) => ({ ...p, [lessonId]: false }))}
                                >
                                  <MaterialIcon name="visibility_off" className="text-sm" />
                                  Ẩn bài tập
                                </button>
                              ) : (
                                <button
                                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold hover:shadow-md transition-all active:scale-95"
                                  onClick={() => setQuizOpen((p) => ({ ...p, [lessonId]: true }))}
                                >
                                  <MaterialIcon name="assignment_add" className="text-sm" />
                                  Luyện tập
                                </button>
                              )
                            )}
                          </div>

                          {/* Quiz panel */}
                          {quizOpen[lessonId] && activeItems.length > 0 && (
                            <WeaknessQuizPanel
                              items={activeItems}
                              subjectName={subjectName}
                              lessonTitle={lessonTitle}
                              onClose={() => setQuizOpen((p) => ({ ...p, [lessonId]: false }))}
                            />
                          )}

                          {/* Weakness items */}
                          <div className="divide-y divide-gray-200">
                            {items.map((p) => (
                              <div
                                key={p.id}
                                className={`px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-white transition-all ${
                                  p.resolved ? "opacity-50" : ""
                                }`}
                              >
                                <div className="flex items-center gap-4 flex-1 min-w-[280px]">
                                  <MaterialIcon
                                    name="error"
                                    className={`text-xl shrink-0 ${p.resolved ? "text-teal-500" : "text-red-500"}`}
                                  />
                                  <div>
                                    <p className={`text-sm font-medium ${p.resolved ? "text-gray-400 line-through" : "text-gray-900"}`}>
                                      <MathText text={p.topic} />
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="bg-red-50 text-red-700 text-[11px] px-2 py-0.5 rounded-md font-bold">
                                        {p.errorCount} lần
                                      </span>
                                      {p.source && sourceConfig[p.source] && (
                                        <span className="bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded-md font-bold border border-blue-100">
                                          {sourceConfig[p.source].label}
                                        </span>
                                      )}
                                      <span className="bg-gray-100 text-gray-500 text-[11px] px-2 py-0.5 rounded-md">
                                        {p.weight.toFixed(1)}đ
                                      </span>
                                      {p.lastErrorAt && (
                                        <span className="text-[11px] text-gray-400">
                                          {new Date(p.lastErrorAt).toLocaleDateString("vi-VN")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {!p.resolved && (
                                  <button
                                    className="flex items-center gap-1.5 text-teal-600 font-bold text-sm hover:underline shrink-0"
                                    onClick={() => handleImprove(p.id)}
                                  >
                                    <MaterialIcon name="check_circle" className="text-lg" />
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
                      topics={[...lessons.values()].flat().filter((p) => !p.resolved).map((p) => p.topic)}
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
