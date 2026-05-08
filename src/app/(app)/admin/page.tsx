"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Users, BookOpen, ClipboardList, Clock, Download } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Overview {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalSubjects: number;
  totalCourses: number;
  totalLessons: number;
  totalAssignments: number;
  totalSubmissions: number;
  pendingGrading: number;
  totalStudyMin: number;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Quản trị viên",
  ADMIN: "Admin",
  TEACHER: "Giáo viên",
  PARENT: "Phụ huynh",
  STUDENT: "Học sinh",
};

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Overview>("/api/analytics/overview")
      .then(setOverview)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Không thể tải dữ liệu</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bảng điều khiển Quản trị</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng người dùng</p>
              <p className="text-xl font-bold text-gray-900">{overview.totalUsers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <BookOpen className="size-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Bài học</p>
              <p className="text-xl font-bold text-gray-900">{overview.totalLessons}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <ClipboardList className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Bài tập</p>
              <p className="text-xl font-bold text-gray-900">{overview.totalAssignments}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="size-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng giờ học</p>
              <p className="text-xl font-bold text-gray-900">{Math.round(overview.totalStudyMin / 60)}h</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by role */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-900">Người dùng theo vai trò</CardTitle>
            <div className="flex gap-3">
              <Link href="/admin/students" className="text-sm text-primary hover:underline">
                Học sinh
              </Link>
              <Link href="/admin/teachers" className="text-sm text-primary hover:underline">
                Giáo viên
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(overview.usersByRole).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{roleLabels[role] || role}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{count}</span>
                    <Badge variant="outline" className="text-xs">{role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Content stats + actions */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-900">Nội dung & Bài nộp</CardTitle>
            <div className="flex gap-3">
              <Link href="/admin/courses" className="text-sm text-primary hover:underline">
                Môn học
              </Link>
              <Link href="/admin/assignments" className="text-sm text-primary hover:underline">
                Bài tập
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Môn học</span>
                <span className="text-sm font-semibold text-gray-900">{overview.totalSubjects}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Bài giảng</span>
                <span className="text-sm font-semibold text-gray-900">{overview.totalLessons}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Tổng bài nộp</span>
                <span className="text-sm font-semibold text-gray-900">{overview.totalSubmissions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Đang chờ chấm</span>
                <Badge variant={overview.pendingGrading > 0 ? "default" : "outline"} className="text-xs">
                  {overview.pendingGrading}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export actions */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/analytics/export/users`}
          className="flex items-center gap-3 rounded-xl border p-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <Download className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Xuất danh sách người dùng</p>
            <p className="text-xs text-gray-500">CSV — Tất cả người dùng trong hệ thống</p>
          </div>
        </a>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/analytics/export/assignments`}
          className="flex items-center gap-3 rounded-xl border p-4 hover:border-gray-300 hover:shadow-sm transition-shadow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
            <Download className="size-5 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">Xuất bảng điểm</p>
            <p className="text-xs text-gray-500">CSV — Tất cả bài nộp và điểm số</p>
          </div>
        </a>
      </div>
    </div>
  );
}
