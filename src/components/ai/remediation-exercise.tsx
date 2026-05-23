"use client";

import { useState } from "react";
import { Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MathText } from "./math-text";

interface McqOption {
  text: string;
  isCorrect: boolean;
}

interface RemediationMcq {
  type: "mcq";
  question: string;
  options: McqOption[];
  explanation: string;
}

interface RemediationShortAnswer {
  type: "short_answer";
  question: string;
  expectedAnswer: string;
  explanation: string;
}

export type RemediationQuestion = RemediationMcq | RemediationShortAnswer;

export type ExerciseAnswer =
  | { type: "mcq"; selectedIdx: number; isCorrect: boolean }
  | { type: "short_answer"; answer: string; isCorrect: boolean };

type McqState = "unanswered" | "correct" | "incorrect";

function McqExercise({
  exercise,
  onCorrect,
  onAttempt,
  onAnswer,
  disabled,
  initialAnswer,
}: {
  exercise: RemediationMcq;
  onCorrect: () => void;
  onAttempt?: () => void;
  onAnswer?: (answer: ExerciseAnswer) => void;
  disabled?: boolean;
  initialAnswer?: { selectedIdx: number; isCorrect: boolean } | null;
}) {
  const [state, setState] = useState<McqState>(
    initialAnswer ? (initialAnswer.isCorrect ? "correct" : "incorrect") : "unanswered"
  );
  const [selectedIdx, setSelectedIdx] = useState<number | null>(initialAnswer?.selectedIdx ?? null);

  const handleSelect = (idx: number) => {
    if (state !== "unanswered" || disabled) return;
    setSelectedIdx(idx);
    const isCorrect = exercise.options[idx].isCorrect;
    setState(isCorrect ? "correct" : "incorrect");
    if (isCorrect) onCorrect();
    onAttempt?.();
    onAnswer?.({ type: "mcq", selectedIdx: idx, isCorrect });
  };

  return (
    <div className="rounded-lg ring-1 ring-foreground/10 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-medium text-gray-900">
          <MathText text={exercise.question} />
        </p>
      </div>
      <div className="p-2 space-y-1">
        {exercise.options.map((opt, idx) => {
          let btnStyle = "w-full text-left px-2.5 py-1.5 rounded text-xs transition border ";
          if (state === "unanswered") {
            btnStyle += disabled
              ? "bg-white border-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-white border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
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
            <button key={idx} className={btnStyle} onClick={() => handleSelect(idx)} disabled={state !== "unanswered" || disabled}>
              <span className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 text-left"><MathText text={opt.text} /></span>
                {state !== "unanswered" && idx === selectedIdx && (
                  state === "correct" ? <Check className="size-3.5 text-green-600 shrink-0" /> : <X className="size-3.5 text-red-600 shrink-0" />
                )}
                {state === "incorrect" && opt.isCorrect && (
                  <Check className="size-3.5 text-green-600 shrink-0" />
                )}
              </span>
            </button>
          );
        })}
      </div>
      {state !== "unanswered" && (
        <div className="px-3 py-2 border-t bg-gray-50/50">
          <p className="text-xs text-gray-600"><MathText text={exercise.explanation} /></p>
        </div>
      )}
    </div>
  );
}

function normalizeAnswer(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function isAnswerCorrect(userAnswer: string, expectedAnswer: string): boolean {
  const u = normalizeAnswer(userAnswer);
  const e = normalizeAnswer(expectedAnswer);
  if (!u || !e) return false;
  if (u === e) return true;
  if (u.includes(e)) return true;
  if (u.length >= 2 && e.includes(u)) return true;
  return false;
}

function ShortAnswerExercise({
  exercise,
  onCorrect,
  onAttempt,
  onAnswer,
  disabled,
  initialAnswer,
}: {
  exercise: RemediationShortAnswer;
  onCorrect: () => void;
  onAttempt?: () => void;
  onAnswer?: (answer: ExerciseAnswer) => void;
  disabled?: boolean;
  initialAnswer?: { answer: string; isCorrect: boolean } | null;
}) {
  const [answer, setAnswer] = useState(initialAnswer?.answer ?? "");
  const [submitted, setSubmitted] = useState(!!initialAnswer);
  const [passed, setPassed] = useState(initialAnswer?.isCorrect ?? false);

  const handleSubmit = () => {
    if (!answer.trim() || submitted || disabled) return;
    const correct = isAnswerCorrect(answer, exercise.expectedAnswer);
    setPassed(correct);
    setSubmitted(true);
    if (correct) onCorrect();
    onAttempt?.();
    onAnswer?.({ type: "short_answer", answer: answer.trim(), isCorrect: correct });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="rounded-lg ring-1 ring-foreground/10 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-gray-50 border-b">
        <p className="text-xs font-medium text-gray-900">
          <MathText text={exercise.question} />
        </p>
      </div>
      <div className="p-2.5 space-y-2">
        {!submitted ? (
          <>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu trả lời ngắn gọn..."
              rows={2}
              className="min-h-0 resize-none text-xs"
              disabled={disabled}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSubmit} disabled={!answer.trim() || disabled} className="text-xs h-7">
                <Send className="size-3 mr-1" />
                Kiểm tra
              </Button>
            </div>
          </>
        ) : (
          <div>
            <div className={`flex items-start gap-2 p-2 rounded ${passed ? "bg-green-50" : "bg-amber-50"}`}>
              {passed ? (
                <Check className="size-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <X className="size-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-medium ${passed ? "text-green-700" : "text-amber-700"}`}>
                  {passed ? "Chính xác!" : "Chưa chính xác"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Bạn trả lời: <span className="text-gray-700 font-medium"><MathText text={answer.trim()} /></span>
                </p>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded space-y-1">
              <p className="text-[11px] text-gray-500">
                <span className="font-medium">Đáp án:</span>{" "}
                <span className="text-gray-800"><MathText text={exercise.expectedAnswer} /></span>
              </p>
              {exercise.explanation && (
                <p className="text-[11px] text-gray-500">
                  <span className="font-medium">Giải thích:</span>{" "}
                  <MathText text={exercise.explanation} />
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RemediationExerciseProps {
  exercise: RemediationQuestion;
  onCorrect: () => void;
  onAttempt?: () => void;
  onAnswer?: (answer: ExerciseAnswer) => void;
  disabled?: boolean;
  initialAnswer?: ExerciseAnswer | null;
}

export function RemediationExercise({
  exercise,
  onCorrect,
  onAttempt,
  onAnswer,
  disabled,
  initialAnswer,
}: RemediationExerciseProps) {
  if (exercise.type === "mcq") {
    const init = initialAnswer?.type === "mcq" ? { selectedIdx: initialAnswer.selectedIdx, isCorrect: initialAnswer.isCorrect } : null;
    return <McqExercise exercise={exercise} onCorrect={onCorrect} onAttempt={onAttempt} onAnswer={onAnswer} disabled={disabled} initialAnswer={init} />;
  }
  const init = initialAnswer?.type === "short_answer" ? { answer: initialAnswer.answer, isCorrect: initialAnswer.isCorrect } : null;
  return <ShortAnswerExercise exercise={exercise} onCorrect={onCorrect} onAttempt={onAttempt} onAnswer={onAnswer} disabled={disabled} initialAnswer={init} />;
}
