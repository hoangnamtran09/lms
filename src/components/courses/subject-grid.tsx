"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { api } from "@/lib/api-client";
import { SubjectCard, SubjectCardSkeleton } from "@/components/courses/subject-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  gradeLevel: number;
}

const gradeLevels = Array.from({ length: 12 }, (_, i) => i + 1);

export function SubjectGrid() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [grade, setGrade] = useState<string>("all");

  useEffect(() => {
    const params = grade !== "all" ? `?gradeLevel=${grade}` : "";
    api<Subject[]>(`/api/subjects${params}`)
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [grade]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Môn học</h1>
          <p className="mt-1 text-sm text-gray-500">Chọn môn học để bắt đầu</p>
        </div>
        <Select value={grade} onValueChange={(v) => setGrade(v || "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả cấp lớp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cấp lớp</SelectItem>
            {gradeLevels.map((g) => (
              <SelectItem key={g} value={String(g)}>Lớp {g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SubjectCardSkeleton key={i} />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="size-12 text-gray-300 mb-4" />
          <p className="text-gray-500">Chưa có môn học nào cho cấp lớp này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <SubjectCard key={s.id} subject={s} />
          ))}
        </div>
      )}
    </div>
  );
}
