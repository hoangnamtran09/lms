"use client";

import { useEffect, useState } from "react";
import { BookOpen, GraduationCap, Clock, FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface LessonContext {
  subjectName: string;
  lessonTitle: string;
  description: string;
  gradeLevel: number;
}

interface LessonSummary {
  summary: string;
  lessonTitle: string;
  subjectName: string;
}

interface Props {
  lessonId: string;
}

export function LessonInfoPanel({ lessonId }: Props) {
  const [ctx, setCtx] = useState<LessonContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    api<LessonContext>(`/api/lessons/${lessonId}/context`)
      .then((data) => {
        setCtx(data);
        // Fetch AI summary after context loads
        setSummaryLoading(true);
        api<LessonSummary>("/api/ai/lesson-summary", {
          method: "POST",
          body: JSON.stringify({ lessonId }),
        })
          .then((s) => setSummary(s.summary))
          .catch(() => setSummary(null))
          .finally(() => setSummaryLoading(false));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

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

  return (
    <div className="flex flex-col h-full border-r border-border bg-white">
      {/* Header */}
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 text-primary mb-1">
          <BookOpen className="size-4" />
          <span className="text-sm font-semibold">Thông tin bài học</span>
        </div>
        <p className="text-xs text-gray-500 leading-snug">{ctx.lessonTitle}</p>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Grade level */}
        {ctx.gradeLevel > 0 && (
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
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="size-3.5" />
          <span>Đang học...</span>
        </div>
      </div>
    </div>
  );
}
