"use client";

import { useEffect, useState, useRef } from "react";
import {
  BookOpen, GraduationCap, Clock, FileText, Sparkles, HelpCircle,
  Check, X, Diamond, Flame, Target, BarChart3,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { InteractiveQuiz } from "@/components/ai/interactive-quiz";
import { bridge } from "@/lib/study-session-bridge";

interface LessonSummary {
  summary: string;
  objectives?: string[];
  lessonTitle: string;
  subjectName: string;
  description: string;
  gradeLevel: number;
}

interface QuizData {
  question: string;
  options: { text: string }[];
  explanation: string;
}

interface Props {
  lessonId: string;
  subjectId?: string;
  activeQuiz?: QuizData | null;
  onQuizAnswered?: (result: { isCorrect: boolean; question: string }) => void;
}

type QuizPhase = "answering" | "result";

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonInfoPanel({ lessonId, subjectId, activeQuiz, onQuizAnswered }: Props) {
  const [ctx, setCtx] = useState<{ subjectName: string; lessonTitle: string; description: string; gradeLevel: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Quiz result state
  const [quizPhase, setQuizPhase] = useState<QuizPhase>("answering");
  const [lastCorrect, setLastCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const prevQuizRef = useRef<string | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session stats
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [diamonds, setDiamonds] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Poll elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(bridge.getElapsed?.() ?? 0);
      setSessionId(bridge.getSessionId?.() ?? null);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  // Reset phase when a new quiz arrives
  useEffect(() => {
    if (activeQuiz && activeQuiz.question !== prevQuizRef.current) {
      prevQuizRef.current = activeQuiz.question;
      setQuizPhase("answering");
      if (phaseTimerRef.current) { clearTimeout(phaseTimerRef.current); phaseTimerRef.current = null; }
      if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }
    }
  }, [activeQuiz]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setObjectives([]);
    setSummaryLoading(true);
    api<LessonSummary>("/api/ai/lesson-summary", {
      method: "POST",
      body: JSON.stringify({ lessonId, subjectId, sessionId: sessionId ?? "" }),
    })
      .then((s) => {
        setCtx({ subjectName: s.subjectName, lessonTitle: s.lessonTitle, description: s.description, gradeLevel: s.gradeLevel });
        setSummary(s.summary);
        if (s.objectives?.length) setObjectives(s.objectives);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setSummaryLoading(false);
        setLoading(false);
      });
  }, [lessonId, sessionId, subjectId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleQuizAnswered = (isCorrect: boolean) => {
    const question = activeQuiz?.question || "";
    setLastCorrect(isCorrect);
    setQuizTotal((t) => t + 1);
    if (isCorrect) {
      setStreak((s) => s + 1);
      setQuizCorrect((c) => c + 1);
      setDiamonds((d) => d + 2);
    } else {
      setStreak(0);
    }
    phaseTimerRef.current = setTimeout(() => setQuizPhase("result"), 1500);
    clearTimerRef.current = setTimeout(() => onQuizAnswered?.({ isCorrect, question }), 4000);
  };

  // -- Loading / Error / Empty states --

  if (loading) {
    return (
      <div className="flex flex-col h-full p-5 space-y-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full p-5 items-center justify-center text-center">
        <FileText className="size-8 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Lỗi tải thông tin</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="flex flex-col h-full p-5 items-center justify-center text-center">
        <FileText className="size-8 text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">Không có thông tin bài học</p>
      </div>
    );
  }

  const showQuiz = !!activeQuiz;
  const showResult = showQuiz && quizPhase === "result";
  const accuracy = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="h-14 flex items-center gap-2 px-5 border-b border-border shrink-0">
        {showResult ? (
          <Check className="size-4 text-green-600" />
        ) : showQuiz ? (
          <HelpCircle className="size-4 text-amber-600" />
        ) : (
          <BookOpen className="size-4 text-primary" />
        )}
        <span className="text-sm font-semibold text-gray-900">
          {showResult ? "Kết quả" : showQuiz ? "Bài tập trắc nghiệm" : "Thông tin bài học"}
        </span>
      </div>

      {/* Lesson title */}
      <div className="px-5 py-3 border-b shrink-0">
        <p className="text-xs text-gray-500 leading-snug">{ctx.lessonTitle}</p>
      </div>

      {/* Content area with transition */}
      <div className="flex-1 overflow-y-auto p-5 relative">
        {/* ---- Summary view ---- */}
        <div
          className={`space-y-4 transition-opacity duration-300 ${
            showQuiz ? "opacity-0 absolute inset-0 px-5 py-5 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Objectives */}
          {objectives.length > 0 && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <Target className="size-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-1.5">Mục tiêu bài học</p>
                <ul className="space-y-1">
                  {objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* AI Summary */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <Sparkles className="size-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Tóm tắt AI</p>
              {summaryLoading ? (
                <div className="mt-1.5 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/6" />
                </div>
              ) : summary ? (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{summary}</p>
              ) : null}
            </div>
          </div>

          {/* Session stats */}
          {quizTotal > 0 && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50">
                <BarChart3 className="size-4 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 mb-1.5">Thống kê phiên học</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-green-50 px-2.5 py-2">
                    <p className="text-xs text-green-600 font-medium">
                      {quizCorrect}/{quizTotal} đúng
                    </p>
                    <p className="text-[10px] text-green-500">
                      {accuracy !== null ? `${accuracy}% chính xác` : ""}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-2.5 py-2">
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                      <Diamond className="size-3" /> {diamonds}
                    </p>
                    <p className="text-[10px] text-amber-500">kim cương</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 px-2.5 py-2 col-span-2">
                    <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                      <Clock className="size-3" /> {formatElapsed(elapsed)}
                    </p>
                    <p className="text-[10px] text-blue-500">thời gian học</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Grade level (shown at bottom when no stats) */}
          {ctx.gradeLevel > 0 && quizTotal === 0 && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
                <GraduationCap className="size-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Khối lớp</p>
                <p className="text-sm font-medium text-gray-900">Lớp {ctx.gradeLevel}</p>
              </div>
            </div>
          )}
        </div>

        {/* ---- Quiz / Result view ---- */}
        {activeQuiz && (
          <div
            className={`transition-opacity duration-300 ${
              showQuiz ? "opacity-100" : "opacity-0 absolute inset-0 px-5 py-5 pointer-events-none"
            }`}
          >
            {/* Quiz phase */}
            <div className={`transition-opacity duration-300 ${showResult ? "opacity-0 absolute inset-0 pointer-events-none" : "opacity-100"}`}>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <HelpCircle className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Trả lời câu hỏi để tiếp tục chat</p>
                  </div>
                </div>
                <InteractiveQuiz
                  quiz={activeQuiz}
                  lessonId={lessonId}
                  subjectId={subjectId}
                  sessionId={sessionId}
                  onAnswered={(isCorrect) => handleQuizAnswered(isCorrect)}
                />
              </div>
            </div>

            {/* Result card */}
            <div
              className={`transition-all duration-500 ${
                showResult ? "opacity-100 scale-100" : "opacity-0 scale-95 absolute inset-0 pointer-events-none"
              }`}
            >
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                {lastCorrect ? (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 animate-bounce">
                      <Check className="size-8 text-green-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-700">Chính xác!</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-4 py-2">
                      <Diamond className="size-5 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-700">+2 kim cương</span>
                    </div>
                    {streak > 1 && (
                      <div className="flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200 px-4 py-2 animate-in zoom-in">
                        <Flame className="size-5 text-orange-500" />
                        <span className="text-sm font-semibold text-orange-700">
                          Đúng liên tiếp {streak} câu!
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                      <X className="size-8 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-600">Chưa đúng</p>
                      <p className="text-xs text-gray-500 mt-1">Xem giải thích bên dưới để hiểu thêm.</p>
                    </div>
                    <div className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2">
                      <p className="text-xs text-gray-600">Đừng lo, cố gắng nhé!</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`p-4 border-t shrink-0 transition-colors duration-300 ${
        showResult ? "bg-green-50" : showQuiz ? "bg-amber-50" : "bg-blue-50"
      }`}>
        <div className={`flex items-center gap-2 text-sm font-medium ${
          showResult ? "text-green-700" : showQuiz ? "text-amber-700" : "text-blue-700"
        }`}>
          <Clock className="size-4" />
          <span>
            {showResult
              ? lastCorrect
                ? "Đã thưởng kim cương!"
                : "Tiếp tục cố gắng"
              : showQuiz
                ? quizPhase === "answering"
                  ? "Đang kiểm tra..."
                  : "Đang đánh giá..."
                : "Đang học..."
            }
          </span>
        </div>
      </div>
    </div>
  );
}
