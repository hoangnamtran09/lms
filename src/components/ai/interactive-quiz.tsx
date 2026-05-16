"use client";

import { useState } from "react";
import { Check, X, Diamond } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { MathText } from "./math-text";

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

interface QuizData {
  question: string;
  options: QuizOption[];
  explanation: string;
}

type QuizState = "unanswered" | "correct" | "incorrect";

export function InteractiveQuiz({
  quiz,
  lessonId,
  onAnswered,
}: {
  quiz: QuizData;
  lessonId: string;
  onAnswered?: (isCorrect: boolean) => void;
}) {
  const [state, setState] = useState<QuizState>("unanswered");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [diamonds, setDiamonds] = useState(0);

  const handleSelect = async (idx: number) => {
    if (state !== "unanswered") return;
    const option = quiz.options[idx];
    const isCorrect = option.isCorrect;
    setSelectedIdx(idx);
    setState(isCorrect ? "correct" : "incorrect");

    // Notify backend
    try {
      const res = await api<{ diamondsEarned?: number; weaknessRecorded?: string; weaknessWeight?: number }>(
        "/api/ai/quiz-answer",
        {
          method: "POST",
          body: JSON.stringify({
            lessonId,
            correct: isCorrect,
            topic: quiz.question.slice(0, 100),
          }),
        }
      );
      if (res.diamondsEarned) setDiamonds(res.diamondsEarned);
      if (res.weaknessRecorded) {
        toast.warning("Điểm yếu đã được ghi nhận", {
          description: `Bạn cần ôn tập thêm chủ đề này (trọng số: ${res.weaknessWeight})`,
          position: "top-right",
        });
      }
    } catch {
      // Silently fail — the quiz UX still works
    }
    onAnswered?.(isCorrect);
  };

  return (
    <div className="my-3 rounded-xl ring-1 ring-foreground/10 bg-white overflow-hidden">
      {/* Question */}
      <div className="px-3 py-2.5 bg-gray-50 border-b">
        <p className="text-sm font-medium text-gray-900"><MathText text={quiz.question} /></p>
      </div>

      {/* Options */}
      <div className="p-2.5 space-y-1.5">
        {quiz.options.map((opt, idx) => {
          let btnStyle =
            "w-full text-left px-3 py-2 rounded-lg text-sm transition border ";
          if (state === "unanswered") {
            btnStyle +=
              "bg-white border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
          } else if (idx === selectedIdx) {
            btnStyle += state === "correct"
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-red-50 border-red-300 text-red-800";
          } else if (opt.isCorrect && state === "incorrect") {
            btnStyle += "bg-green-50 border-green-300 text-green-800";
          } else {
            btnStyle += "bg-white border-gray-100 text-gray-400";
          }

          return (
            <button
              key={idx}
              className={btnStyle}
              onClick={() => handleSelect(idx)}
              disabled={state !== "unanswered"}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1"><MathText text={opt.text} /></span>
                {state !== "unanswered" && idx === selectedIdx && (
                  state === "correct" ? (
                    <Check className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <X className="size-4 text-red-600 shrink-0" />
                  )
                )}
                {state === "incorrect" && opt.isCorrect && (
                  <Check className="size-4 text-green-600 shrink-0" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {state !== "unanswered" && (
        <div className="px-3 py-2.5 border-t">
          {state === "correct" ? (
            <div className="flex items-start gap-2">
              <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Chính xác!</p>
                {diamonds > 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                    <Diamond className="size-3" />+{diamonds} kim cương
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1"><MathText text={quiz.explanation} /></p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <X className="size-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">Chưa đúng</p>
                <p className="text-xs text-gray-600 mt-1"><MathText text={quiz.explanation} /></p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
