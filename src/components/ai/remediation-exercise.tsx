"use client";

import { useState } from "react";
import { Check, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MathText } from "./math-text";
import { api } from "@/lib/api-client";

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

type McqState = "unanswered" | "correct" | "incorrect";

function McqExercise({
  exercise,
  onCorrect,
}: {
  exercise: RemediationMcq;
  onCorrect: () => void;
}) {
  const [state, setState] = useState<McqState>("unanswered");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleSelect = (idx: number) => {
    if (state !== "unanswered") return;
    setSelectedIdx(idx);
    const isCorrect = exercise.options[idx].isCorrect;
    setState(isCorrect ? "correct" : "incorrect");
    if (isCorrect) onCorrect();
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
            btnStyle += "bg-white border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer";
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
            <button key={idx} className={btnStyle} onClick={() => handleSelect(idx)} disabled={state !== "unanswered"}>
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

function ShortAnswerExercise({
  exercise,
  onCorrect,
  lessonId,
}: {
  exercise: RemediationShortAnswer;
  onCorrect: () => void;
  lessonId: string;
}) {
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [passed, setPassed] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim() || grading) return;
    setGrading(true);
    try {
      const res = await api<{ score: number; feedback: string; isPassed: boolean; weaknessRecorded?: boolean; weaknessWeight?: number }>(
        "/api/ai/grade-exercise",
        {
          method: "POST",
          body: JSON.stringify({
            question: exercise.question,
            userAnswer: answer.trim(),
            lessonId,
          }),
        }
      );
      setFeedback(res.feedback);
      setPassed(res.isPassed);
      if (res.isPassed) onCorrect();
      if (res.weaknessRecorded) {
        toast.warning("Điểm yếu đã được ghi nhận", {
          description: `Bài tập đạt ${res.score} điểm — bạn cần cải thiện thêm (trọng số: ${res.weaknessWeight})`,
          position: "top-right",
        });
      }
    } catch {
      setFeedback("Không thể chấm bài. Hãy thử lại.");
    } finally {
      setGrading(false);
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
        {!feedback ? (
          <>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Nhập câu trả lời của bạn..."
              rows={3}
              className="min-h-0 resize-none text-xs"
              disabled={grading}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSubmit} disabled={!answer.trim() || grading} className="text-xs h-7">
                {grading ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Send className="size-3 mr-1" />
                )}
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
                  {passed ? "Chính xác!" : "Cần cải thiện"}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{feedback}</p>
              </div>
            </div>
            <div className="mt-2 p-2 bg-gray-50 rounded">
              <p className="text-[11px] text-gray-500">
                <span className="font-medium">Đáp án mong đợi:</span>{" "}
                <MathText text={exercise.explanation} />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RemediationExercise({
  exercise,
  onCorrect,
  lessonId,
}: {
  exercise: RemediationQuestion;
  onCorrect: () => void;
  lessonId: string;
}) {
  if (exercise.type === "mcq") {
    return <McqExercise exercise={exercise} onCorrect={onCorrect} />;
  }
  return <ShortAnswerExercise exercise={exercise} onCorrect={onCorrect} lessonId={lessonId} />;
}
