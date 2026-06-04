"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { MaterialIcon } from "@/components/ui/material-icon";

export function WeaknessSummary({
  topics,
  subjectName,
  lessonTitle,
}: {
  topics: string[];
  subjectName: string;
  lessonTitle: string;
}) {
  const [result, setResult] = useState<{ loading: boolean; summary: string | null }>({
    loading: topics.length > 0,
    summary: null,
  });

  useEffect(() => {
    if (topics.length === 0) return;
    let cancelled = false;
    api<{ summary: string }>("/api/ai/summarize-weaknesses", {
      method: "POST",
      body: JSON.stringify({ topics, subjectName, lessonTitle }),
    })
      .then((data) => { if (!cancelled) setResult({ loading: false, summary: data.summary }); })
      .catch(() => { if (!cancelled) setResult({ loading: false, summary: null }); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (topics.length === 0) return null;

  return (
    <div className="px-6 py-2.5 border-t border-outline-variant/50 bg-gradient-to-r from-indigo-50/30 to-purple-50/30">
      {result.loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="size-3 animate-spin" />
          AI đang phân tích...
        </div>
      ) : result.summary ? (
        <div className="flex items-start gap-2 text-xs text-gray-600">
          <MaterialIcon name="psychology" className="text-sm text-indigo-500 shrink-0 mt-0.5" />
          <span>{result.summary}</span>
        </div>
      ) : null}
    </div>
  );
}
