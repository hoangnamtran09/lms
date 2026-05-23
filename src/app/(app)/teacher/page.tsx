"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, ClipboardList, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  students: { id: string; fullName: string; classId: string; totalStudy: number; streak: number }[];
  assignmentCount: number;
  pendingGrading: number;
  recentSubmissions: { studentName: string; title: string; status: string; submittedAt: string }[];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

const statusLabel: Record<string, string> = {
  SUBMITTED: "Chờ chấm",
  GRADED: "Đã chấm",
  RETURNED: "Đã trả",
};

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>("/api/teacher/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Redirect if user is not teacher/admin
  if (user && user.role !== "TEACHER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    router.replace("/");
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} delay={80 + i * 100} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton delay={400} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Không thể tải dữ liệu</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bảng điều khiển Giáo viên</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Học sinh</p>
              <p className="text-xl font-bold text-gray-900">{data.students.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Chờ chấm</p>
              <p className="text-xl font-bold text-gray-900">{data.pendingGrading}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <ClipboardList className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Bài tập đã tạo</p>
              <p className="text-xl font-bold text-gray-900">{data.assignmentCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Học sinh của bạn</CardTitle>
          </CardHeader>
          <CardContent>
            {data.students.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có học sinh nào</p>
            ) : (
              <div className="space-y-2">
                {data.students.slice(0, 10).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm py-1.5">
                    <div>
                      <span className="font-medium text-gray-900">{s.fullName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatDuration(s.totalStudy)}</span>
                      {s.streak > 0 && (
                        <Badge variant="outline" className="text-xs">🔥 {s.streak} ngày</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent submissions */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Bài nộp gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentSubmissions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có bài nộp nào</p>
            ) : (
              <div className="space-y-2">
                {data.recentSubmissions.map((sub, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5">
                    <div>
                      <span className="text-gray-900">{sub.studentName}</span>
                      <span className="text-gray-400 ml-2">— {sub.title}</span>
                    </div>
                    <Badge variant={sub.status === "SUBMITTED" ? "default" : "secondary"} className="text-xs">
                      {statusLabel[sub.status] || sub.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <Link href="/assignments" className="text-sm text-primary hover:underline mt-3 inline-block">
              Xem tất cả bài tập
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
