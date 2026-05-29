"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2, Sparkles, Clock } from "lucide-react";

interface Props {
  loading: boolean;
  questionCount: number;
  hasMatrix: boolean;
}

const STATUS_MESSAGES = [
  "Đang đọc nội dung bài học...",
  "Đang phân tích kiến thức trọng tâm...",
  "Đang tạo câu hỏi...",
  "Đang kiểm tra đáp án...",
  "Đang hoàn thiện...",
];

export default function GeneratingOverlay({ loading, questionCount, hasMatrix }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      setStatusIndex(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  // Cycle status messages every 8 seconds
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setStatusIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
    }, 8000);
    return () => clearInterval(timer);
  }, [loading]);

  if (!loading) return null;

  // Estimate: ~8s per question for matrix, ~5s for simple generation
  const secondsPerQuestion = hasMatrix ? 8 : 5;
  const estimatedTotal = questionCount * secondsPerQuestion;
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
  const progress = estimatedTotal > 0 ? Math.min(95, Math.round((elapsed / estimatedTotal) * 100)) : 0;

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}p${sec}s`;
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-10 bg-blue-500 rounded-xl flex items-center justify-center">
          <Sparkles className="size-5 text-white animate-pulse" />
        </div>
        <div>
          <p className="font-bold text-blue-700 text-sm">AI đang tạo câu hỏi</p>
          <p className="text-xs text-blue-500">{STATUS_MESSAGES[statusIndex]}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-500 bg-blue-100 px-2.5 py-1 rounded-full">
          <Clock className="size-3" />
          {formatTime(elapsed)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-blue-400">
          <span>{questionCount} câu hỏi{hasMatrix ? " · có ma trận" : ""}</span>
          <span>
            {estimatedRemaining > 0
              ? `Dự kiến còn ~${formatTime(estimatedRemaining)}`
              : "Đang hoàn thiện..."}
          </span>
        </div>
      </div>

      {/* Tips */}
      <p className="text-[11px] text-blue-400 text-center">
        Thời gian tạo phụ thuộc vào số lượng câu hỏi và độ phức tạp của ma trận
      </p>
    </div>
  );
}
