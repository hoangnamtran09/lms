"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Users, ChevronRight, Search, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";

interface StudentBrief {
  id: string;
  fullName: string;
  classId?: string;
  username?: string;
}

export default function TeacherReportsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<StudentBrief[]>("/api/teacher/students")
      .then((data) => setStudents(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) =>
    s.fullName.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-64" />
        <Skeleton delay={80} className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} delay={80 + i * 80} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo học sinh</h1>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} học sinh
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm học sinh..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Users className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {search ? "Không tìm thấy học sinh nào" : "Chưa có học sinh nào"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/teacher/reports/${s.id}`}
              className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-10 rounded-full bg-blue-100 text-blue-600 font-bold text-sm">
                  {s.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-500">{s.username || s.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <BarChart3 className="size-4" />
                <span>Xem báo cáo</span>
                <ChevronRight className="size-4" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
