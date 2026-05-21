"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: string;
  title: string;
  description: string;
  maxScore: number;
  dueDate: string;
  status: string;
  source: string;
  creatorName: string;
  createdAt: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: string;
  score: number | null;
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
  const router = useRouter();
  const { user } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [myStatuses, setMyStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Assignment[]>("/api/assignments")
      .then(async (list) => {
        setAssignments(list);
        // First check sessionStorage for locally submitted assignments
        const statuses: Record<string, string> = {};
        list.forEach((a) => {
          try {
            if (sessionStorage.getItem(`submitted-${a.id}`) === "true") {
              statuses[a.id] = "SUBMITTED";
            }
          } catch {}
        });
        // Then fetch submission status from API (overrides sessionStorage)
        if (list.length > 0) {
          const results = await Promise.allSettled(
            list.map((a) =>
              api<Submission[]>(`/api/assignments/${a.id}/submissions`).then(
                (subs) => [a.id, subs.find((s) => s.studentId === user?.id)] as const
              )
            )
          );
          results.forEach((r) => {
            if (r.status === "fulfilled") {
              const [assignmentId, sub] = r.value;
              if (sub?.status) {
                statuses[assignmentId] = sub.status;
                try { sessionStorage.setItem(`submitted-${assignmentId}`, "true"); } catch {}
              }
            }
          });
        }
        setMyStatuses(statuses);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} delay={80 + i * 100} className="h-24 w-full rounded-lg" />
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
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">Bài tập cần hoàn thành</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <FileText className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có bài tập nào được giao</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const subStatus = myStatuses[a.id];
            const displayStatus = subStatus || a.status;
            return (
              <Link
                key={a.id}
                href={
                  user?.role === "TEACHER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN"
                    ? `/admin/assignments/${a.id}`
                    : `/assignments/${a.id}`
                }
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{a.title}</h3>
                      <Badge variant={statusVariant[displayStatus] || "secondary"}>
                        {statusLabel[displayStatus] || displayStatus}
                      </Badge>
                      {a.source === "weakness" && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Điểm yếu
                        </Badge>
                      )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
