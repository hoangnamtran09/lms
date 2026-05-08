"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Clock, FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  dueDate: string;
  status: string;
  creatorName: string;
  createdAt: string;
}

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ASSIGNED: "secondary",
  SUBMITTED: "default",
  GRADED: "default",
  RETURNED: "destructive",
  ACCEPTED: "outline",
};

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isTeacher = user?.role === "TEACHER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  useEffect(() => {
    api<Assignment[]>("/api/assignments")
      .then(setAssignments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Không thể tải danh sách bài tập</p>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTeacher ? "Quản lý bài tập của bạn" : "Bài tập cần hoàn thành"}
          </p>
        </div>
        {isTeacher && (
          <Link href="/assignments/new">
            <Button size="sm">
              <Plus className="size-4" />
              <span className="ml-2 hidden sm:inline">Tạo bài tập</span>
            </Button>
          </Link>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <FileText className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {isTeacher ? "Chưa có bài tập nào. Tạo bài tập đầu tiên!" : "Chưa có bài tập nào được giao"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/assignments/${a.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                    <Badge variant={statusVariant[a.status] || "secondary"}>
                      {statusLabel[a.status] || a.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1">{a.description || "Không có mô tả"}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>Điểm tối đa: {a.maxScore}</span>
                    {a.dueDate && (
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Hạn: {new Date(a.dueDate).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                    {a.creatorName && <span>GV: {a.creatorName}</span>}
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-300 shrink-0 mt-2" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
