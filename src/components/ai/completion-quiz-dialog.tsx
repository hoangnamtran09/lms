"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InteractiveQuiz } from "@/components/ai/interactive-quiz";

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  question: string;
  options: QuizOption[];
  explanation: string;
}

interface CompletionQuizResponse {
  questions: QuizQuestion[];
}

type Phase = "loading" | "quiz" | "summary";

export function CompletionQuizDialog({
  open,
  lessonId,
  onComplete,
  preloadedQuestions,
}: {
  open: boolean;
  lessonId: string;
  onComplete: () => void;
  preloadedQuestions?: QuizQuestion[] | null;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCurrentIndex(0);
    setCorrectCount(0);

    if (preloadedQuestions?.length) {
      setQuestions(preloadedQuestions);
      setPhase("quiz");
      return;
    }

    setPhase("loading");
    api<CompletionQuizResponse>("/api/ai/completion-quiz", {
      method: "POST",
      body: JSON.stringify({ lessonId, questionCount: 5 }),
    })
      .then((data) => {
        if (!data.questions?.length) {
          setError("Không thể tạo câu hỏi. Vui lòng thử lại.");
        } else {
          setQuestions(data.questions);
          setPhase("quiz");
        }
      })
      .catch((e) => setError(e.message || "Lỗi tạo câu hỏi"));
  }, [open, lessonId, preloadedQuestions]);

  const handleAnswered = (isCorrect: boolean) => {
    if (isCorrect) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    if (currentIndex >= questions.length - 1) {
      setPhase("summary");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const question = questions[currentIndex];
  const total = questions.length;

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
      >
        {phase === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>Đánh giá bài học</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-gray-500">Đang tạo câu hỏi từ nội dung bài học...</p>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </>
        )}

        {phase === "quiz" && question && (
          <>
            <DialogHeader>
              <DialogTitle>Đánh giá bài học</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-gray-500">
              Câu {currentIndex + 1}/{total}
            </p>
            <InteractiveQuiz
              key={currentIndex}
              quiz={question}
              lessonId={lessonId}
              onAnswered={(isCorrect) => handleAnswered(isCorrect)}
            />
            <div className="flex justify-end">
              <Button
                onClick={handleNext}
                size="sm"
                className="text-xs"
              >
                {currentIndex >= total - 1 ? "Xem kết quả" : "Câu tiếp theo"}
              </Button>
            </div>
          </>
        )}

        {phase === "quiz" && !question && error && (
          <>
            <DialogHeader>
              <DialogTitle>Đánh giá bài học</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-red-500 text-center py-4">{error}</p>
            <div className="flex justify-end">
              <Button onClick={onComplete} size="sm" className="text-xs">
                Bỏ qua
              </Button>
            </div>
          </>
        )}

        {phase === "summary" && (
          <>
            <DialogHeader>
              <DialogTitle>Kết quả</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {correctCount}/{total}
                </span>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {correctCount === total
                  ? "Tuyệt vời! Bạn đã trả lời đúng tất cả câu hỏi."
                  : correctCount >= total / 2
                    ? "Khá tốt! Hãy xem lại những câu sai trong mục Điểm yếu."
                    : "Bạn nên ôn tập lại bài học. Các câu sai đã được ghi vào mục Điểm yếu."}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Check className="size-3.5 text-green-600" />
                  {correctCount} đúng
                </span>
                <span className="flex items-center gap-1">
                  <X className="size-3.5 text-red-600" />
                  {total - correctCount} sai
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={onComplete} size="sm" className="text-xs">
                Hoàn thành
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
