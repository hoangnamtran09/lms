"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: "subject" | "course" | "lesson";
  link: string;
}

const typeLabels: Record<string, string> = {
  subject: "Môn học",
  course: "Khóa học",
  lesson: "Bài học",
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api<SearchResult[]>(`/api/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data);
        setShow(true);
      } catch {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShow(false);
    }
  };

  return (
    <div ref={ref} className="relative hidden sm:block">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (results.length > 0) setShow(true); }}
            placeholder="Tìm kiếm..."
            className="w-48 lg:w-64 h-8 pl-8 text-xs rounded-lg"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 animate-spin" />
          )}
        </div>
      </form>

      {show && results.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-80 sm:w-96 rounded-xl border border-border bg-white shadow-lg z-50">
          {results.map((r) => (
            <a
              key={r.type + r.id}
              href={r.link}
              onClick={() => setShow(false)}
              className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{r.title}</p>
                {r.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                )}
                <span className="text-[10px] text-gray-400 mt-0.5 inline-block">
                  {typeLabels[r.type]}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
