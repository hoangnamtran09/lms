"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { MaterialIcon } from "@/components/ui/material-icon";
import { MathText } from "@/components/ai/math-text";

interface WeaknessProfile {
  id: string;
  topic: string;
}

export interface WeaknessOption {
  text: string;
  isCorrect: boolean;
}

export interface WeaknessQuestion {
  id?: string;
  question: string;
  weaknessTopic?: string;
  weaknessId?: string;
  options?: WeaknessOption[];
  answered?: boolean;
  correct?: boolean;
  selectedIdx?: number;
  explanation?: string;
}

interface QuizState {
  loading: boolean;
  questions: WeaknessQuestion[];
  error?: string;
}

export function WeaknessQuizPanel({
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
  const [state, setState] = useState<QuizState>({ loading: true, questions: [] });
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
      if (correct && weaknessId) await api(`/api/weaknesses/${weaknessId}/resolve`, { method: "POST" });
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
        <div className="text-sm text-red-500">Lỗi: {state.error}</div>
        <button className="text-xs text-blue-600 underline mt-1" onClick={onClose}>Thử lại</button>
      </div>
    );
  }

  const answeredCount = state.questions.filter((q: WeaknessQuestion) => q.answered).length;
  const correctCount = state.questions.filter((q: WeaknessQuestion) => q.correct).length;

  return (
    <div className="border-t border-outline-variant bg-surface-container-lowest">
      <div className="px-6 py-3 flex items-center justify-between bg-surface-container-low">
        <div className="flex items-center gap-2">
          <MaterialIcon name="assignment" className="text-primary text-lg" />
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
                <MaterialIcon
                  name={q.answered ? (q.correct ? "check_circle" : "cancel") : "radio_button_unchecked"}
                  className={`text-xl shrink-0 mt-0.5 ${q.answered ? (q.correct ? "text-teal-600" : "text-red-500") : "text-gray-400"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    <span className="text-gray-300 mr-2">#{qIdx + 1}</span>
                    <MathText text={q.question} />
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
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
                              ? "bg-teal-50 text-teal-800 font-semibold"
                              : oIdx === q.selectedIdx
                                ? "bg-red-50 text-red-700"
                                : "bg-gray-50 text-gray-400"
                            : "bg-gray-50 hover:bg-blue-50 text-gray-900 hover:text-blue-800"
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
                    <p className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded-lg">
                      💡 <MathText text={q.explanation} />
                    </p>
                  )}
                  {q.answered && q.correct && (
                    <p className="mt-1 text-xs text-teal-600 font-semibold">✅ Đã đánh dấu đã hiểu!</p>
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
