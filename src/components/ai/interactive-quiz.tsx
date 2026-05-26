"use client";

import { useState } from "react";
import { Check, X, Diamond, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { MathText } from "./math-text";

interface QuizOption {
  text: string;
}

interface QuizData {
  question: string;
  options: QuizOption[];
  explanation: string;
}

type QuizState = "unanswered" | "loading" | "correct" | "incorrect";

export function InteractiveQuiz({
  quiz,
  lessonId,
  sessionId,
  onAnswered,
}: {
  quiz: QuizData;
  lessonId: string;
  sessionId: string | null;
  onAnswered?: (isCorrect: boolean) => void;
}) {
  const [state, setState] = useState<QuizState>("unanswered");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [diamonds, setDiamonds] = useState(0);
  const [explanation, setExplanation] = useState("");

  const handleSelect = async (idx: number) => {
    if (state !== "unanswered") return;
    setSelectedIdx(idx);
    setState("loading");

    try {
      const res = await api<{ isCorrect: boolean; explanation: string; diamondsEarned?: number; weaknessRecorded?: string }>(
        "/api/ai/validate-quiz",
        {
          method: "POST",
          body: JSON.stringify({
            lessonId,
              sessionId: sessionId ?? "",
            question: quiz.question,
            selectedIndex: idx,
          }),
        }
      );
      setState(res.isCorrect ? "correct" : "incorrect");
      setExplanation(res.explanation || quiz.explanation);
      if (res.diamondsEarned) setDiamonds(res.diamondsEarned);
      if (res.weaknessRecorded) {
        toast.warning("Điểm yếu đã được ghi nhận", {
          description: "Bạn cần ôn tập thêm chủ đề này",
          position: "top-right",
        });
      }
      onAnswered?.(res.isCorrect);
    } catch {
      setState("incorrect");
      onAnswered?.(false);
    }
  };

  return (
    <div className="my-3 rounded-xl ring-1 ring-foreground/10 bg-white overflow-hidden">
      <div className="px-3 py-2.5 bg-gray-50 border-b">
        <p className="text-sm font-medium text-gray-900"><MathText text={quiz.question} /></p>
      </div>
      <div className="p-2.5 space-y-1.5">
        {quiz.options.map((opt, idx) => {
          let btnStyle =
            "w-full text-left px-3 py-2 rounded-lg text-sm transition border ";
          if (state === "unanswered" || state === "loading") {
            btnStyle +=
              "bg-white border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
          } else if (idx === selectedIdx) {
            btnStyle += state === "correct"
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-red-50 border-red-300 text-red-800";
          } else {
            btnStyle += "bg-white border-gray-100 text-gray-400";
          }

          return (
            <button
              key={idx}
              className={btnStyle}
              onClick={() => handleSelect(idx)}
              disabled={state !== "unanswered" && state !== "loading"}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1"><MathText text={opt.text} /></span>
                {state === "loading" && idx === selectedIdx && (
                  <Loader2 className="size-4 text-gray-400 shrink-0 animate-spin" />
                )}
                {state !== "unanswered" && state !== "loading" && idx === selectedIdx && (
                  state === "correct" ? (
                    <Check className="size-4 text-green-600 shrink-0" />
                  ) : (
                    <X className="size-4 text-red-600 shrink-0" />
                  )
                )}
              </span>
            </button>
          );
        })}
      </div>
      {state !== "unanswered" && state !== "loading" && (
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
                <p className="text-xs text-gray-600 mt-1"><MathText text={explanation} /></p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <X className="size-4 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">Chưa đúng</p>
                <p className="text-xs text-gray-600 mt-1"><MathText text={explanation} /></p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
