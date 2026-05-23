"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Search, BookOpen, FileText, GraduationCap, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: "subject" | "course" | "lesson";
  link: string;
}

const typeIcons: Record<string, typeof GraduationCap> = {
  subject: GraduationCap,
  course: BookOpen,
  lesson: FileText,
};

const typeLabels: Record<string, string> = {
  subject: "Môn học",
  course: "Khóa học",
  lesson: "Bài học",
};

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = use(searchParams);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q?.trim()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api<SearchResult[]>(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Kết quả tìm kiếm</h1>
      <p className="text-sm text-gray-500 mb-6">
        {q ? `Hiển thị kết quả cho "${q}"` : "Nhập từ khóa để tìm kiếm"}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-gray-400" />
        </div>
      ) : results.length === 0 && q ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="size-10 text-gray-300 mb-3" />
          <p className="text-gray-500">Không tìm thấy kết quả nào</p>
          <p className="text-sm text-gray-400 mt-1">Thử tìm kiếm với từ khóa khác</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r) => {
            const Icon = typeIcons[r.type];
            return (
              <Link
                key={r.type + r.id}
                href={r.link}
                className="flex items-center gap-4 rounded-xl ring-1 ring-foreground/10 bg-white p-4 transition hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <Icon className="size-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{r.title}</p>
                    <span className="shrink-0 text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {typeLabels[r.type]}
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
