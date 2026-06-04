"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { MaterialIcon } from "@/components/ui/material-icon";

export function WeaknessSummary({
  topics,
  subjectName,
}: {
  topics: string[];
  subjectName: string;
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
      body: JSON.stringify({ topics, subjectName, lessonTitle: "" }),
    })
      .then((data) => { if (!cancelled) setResult({ loading: false, summary: data.summary }); })
      .catch(() => { if (!cancelled) setResult({ loading: false, summary: null }); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (topics.length === 0) return null;

  return (
    <div className="p-4 mx-6 mb-6 mt-2 bg-indigo-50/50 rounded-xl border border-indigo-100 flex gap-4 items-start">
      <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
        <MaterialIcon name="auto_awesome" className="text-xl" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-indigo-900 mb-1">Nhận xét từ AI</h4>
        {result.loading ? (
          <div className="flex items-center gap-2 text-xs text-indigo-400">
            <Loader2 className="size-3 animate-spin" />
            Đang phân tích...
          </div>
        ) : result.summary ? (
          <p className="text-sm text-indigo-800 leading-relaxed">{result.summary}</p>
        ) : null}
      </div>
    </div>
  );
}
