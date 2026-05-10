"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, BookOpen, ClipboardList, Clock, Download,
  TrendingUp, Sparkles, GraduationCap, AlertCircle, ArrowUpRight, FileText, CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
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

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500",
  ADMIN: "bg-orange-500",
  TEACHER: "bg-blue-500",
  PARENT: "bg-purple-500",
  STUDENT: "bg-emerald-500",
};

const roleBgColors: Record<string, string> = {
  SUPER_ADMIN: "bg-red-50 text-red-700",
  ADMIN: "bg-orange-50 text-orange-700",
  TEACHER: "bg-blue-50 text-blue-700",
  PARENT: "bg-purple-50 text-purple-700",
  STUDENT: "bg-emerald-50 text-emerald-700",
};

function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 1000) return `${(h / 1000).toFixed(1)}k giờ`;
  if (h >= 1) return `${h}h ${m > 0 ? m + "m" : ""}`;
  return `${m} phút`;
}

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
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <AlertCircle className="size-12 text-gray-300 mb-4" />
        <p className="text-gray-500">Không thể tải dữ liệu bảng điều khiển</p>
      </div>
    );
  }

  const roleEntries = Object.entries(overview.usersByRole).sort(([, a], [, b]) => b - a);
  const maxRoleCount = Math.max(...roleEntries.map(([, c]) => c), 1);
  const gradableRate = overview.totalSubmissions > 0
    ? Math.round(((overview.totalSubmissions - overview.pendingGrading) / overview.totalSubmissions) * 100)
    : 100;

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-200">
            <Sparkles className="size-5 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Bảng điều khiển
          </h1>
        </div>
        <p className="text-gray-500 ml-13">
          Tổng quan hệ thống — theo dõi và quản lý toàn bộ nền tảng học tập
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {/* Users */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl shadow-blue-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[80px]" />
          <div className="relative p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20 backdrop-blur">
                <Users className="size-5" />
              </div>
              <span className="text-sm font-medium text-blue-100">Tổng người dùng</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">{overview.totalUsers}</p>
            <div className="flex items-center gap-1 text-blue-100 text-xs">
              <TrendingUp className="size-3" />
              <span>{roleEntries.length} vai trò trong hệ thống</span>
            </div>
          </div>
        </Card>

        {/* Lessons */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[80px]" />
          <div className="relative p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20 backdrop-blur">
                <BookOpen className="size-5" />
              </div>
              <span className="text-sm font-medium text-emerald-100">Tổng bài học</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">{overview.totalLessons}</p>
            <div className="flex items-center gap-1 text-emerald-100 text-xs">
              <span>{overview.totalSubjects} môn học · {overview.totalCourses} khoá học</span>
            </div>
          </div>
        </Card>

        {/* Assignments */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[80px]" />
          <div className="relative p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20 backdrop-blur">
                <ClipboardList className="size-5" />
              </div>
              <span className="text-sm font-medium text-amber-100">Tổng bài tập</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">{overview.totalAssignments}</p>
            <div className="flex items-center gap-1 text-amber-100 text-xs">
              <FileText className="size-3" />
              <span>{overview.totalSubmissions} bài đã nộp</span>
            </div>
          </div>
        </Card>

        {/* Study Time */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl shadow-violet-200">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-[80px]" />
          <div className="relative p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20 backdrop-blur">
                <Clock className="size-5" />
              </div>
              <span className="text-sm font-medium text-violet-100">Tổng giờ học</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">{formatStudyTime(overview.totalStudyMin)}</p>
            <div className="flex items-center gap-1 text-violet-100 text-xs">
              <GraduationCap className="size-3" />
              <span>{Math.round(overview.totalStudyMin / 60)} giờ học tập</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Role distribution - wider column */}
        <Card className="lg:col-span-2 rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Phân bố người dùng</h3>
              <p className="text-xs text-gray-500 mt-0.5">Theo vai trò trong hệ thống</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/students" className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                Học sinh
              </Link>
              <Link href="/admin/teachers" className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">
                Giáo viên
              </Link>
            </div>
          </div>
          <div className="space-y-4">
            {roleEntries.map(([role, count]) => {
              const pct = Math.round((count / maxRoleCount) * 100);
              const sharePct = overview.totalUsers > 0 ? Math.round((count / overview.totalUsers) * 100) : 0;
              return (
                <div key={role} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-gray-800">{roleLabels[role] || role}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 font-medium ${roleBgColors[role] || "bg-gray-50 text-gray-600"}`}>
                        {sharePct}%
                      </Badge>
                    </div>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{count}</span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${roleColors[role] || "bg-gray-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Grading status */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Tiến độ chấm bài</h3>
          <p className="text-xs text-gray-500 mb-5">Trạng thái chấm bài tập</p>

          {/* Donut-style indicator */}
          <div className="flex items-center justify-center mb-5">
            <div className="relative size-28">
              <svg viewBox="0 0 112 112" className="size-full -rotate-90">
                <circle cx="56" cy="56" r="48" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle
                  cx="56" cy="56" r="48"
                  fill="none"
                  stroke={gradableRate >= 90 ? "#10b981" : gradableRate >= 70 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(gradableRate / 100) * 301.6} 301.6`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-gray-900">{gradableRate}%</span>
                <span className="text-[10px] text-gray-500">đã chấm</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-auto">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="text-gray-600">Đã chấm</span>
              </div>
              <span className="font-semibold text-gray-900">{overview.totalSubmissions - overview.pendingGrading}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 text-amber-500" />
                <span className="text-gray-600">Chờ chấm</span>
              </div>
              <span className={`font-semibold ${overview.pendingGrading > 0 ? "text-amber-600" : "text-gray-400"}`}>
                {overview.pendingGrading}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-600 font-medium">Tổng bài nộp</span>
              <span className="font-bold text-gray-900">{overview.totalSubmissions}</span>
            </div>
            {overview.pendingGrading > 0 && (
              <Link
                href="/admin/assignments"
                className="flex items-center justify-center gap-1.5 w-full py-2 mt-2 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
              >
                Đi chấm bài ngay
                <ArrowUpRight className="size-3" />
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link
          href="/admin/users"
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 transition-all bg-white"
        >
          <div className="flex items-center justify-center size-11 rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
            <Users className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Quản lý người dùng</p>
            <p className="text-xs text-gray-500">Thêm, sửa, xoá tài khoản</p>
          </div>
          <ArrowUpRight className="size-4 text-gray-300 group-hover:text-blue-500 ml-auto transition-colors" />
        </Link>
        <Link
          href="/admin/courses"
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-50 transition-all bg-white"
        >
          <div className="flex items-center justify-center size-11 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
            <BookOpen className="size-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Môn &amp; Khoá học</p>
            <p className="text-xs text-gray-500">{overview.totalSubjects} môn, {overview.totalCourses} khoá</p>
          </div>
          <ArrowUpRight className="size-4 text-gray-300 group-hover:text-emerald-500 ml-auto transition-colors" />
        </Link>
        <Link
          href="/admin/assignments"
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-md hover:shadow-amber-50 transition-all bg-white"
        >
          <div className="flex items-center justify-center size-11 rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors">
            <ClipboardList className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Bài tập &amp; Chấm điểm</p>
            <p className="text-xs text-gray-500">{overview.pendingGrading} bài đang chờ chấm</p>
          </div>
          <ArrowUpRight className="size-4 text-gray-300 group-hover:text-amber-500 ml-auto transition-colors" />
        </Link>
        <Link
          href="/admin/teachers"
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md hover:shadow-purple-50 transition-all bg-white"
        >
          <div className="flex items-center justify-center size-11 rounded-xl bg-purple-50 group-hover:bg-purple-100 transition-colors">
            <GraduationCap className="size-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Giáo viên</p>
            <p className="text-xs text-gray-500">{overview.usersByRole.TEACHER || 0} giáo viên</p>
          </div>
          <ArrowUpRight className="size-4 text-gray-300 group-hover:text-purple-500 ml-auto transition-colors" />
        </Link>
      </div>

      {/* Export */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/analytics/export/users`}
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-md shadow-blue-200 group-hover:shadow-lg group-hover:shadow-blue-300 transition-shadow">
            <Download className="size-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Xuất danh sách người dùng</p>
            <p className="text-xs text-gray-500 mt-0.5">CSV — Tất cả người dùng trong hệ thống</p>
          </div>
        </a>
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/analytics/export/assignments`}
          className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 hover:border-emerald-300 hover:shadow-lg transition-all"
        >
          <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200 group-hover:shadow-lg group-hover:shadow-emerald-300 transition-shadow">
            <Download className="size-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">Xuất bảng điểm</p>
            <p className="text-xs text-gray-500 mt-0.5">CSV — Tất cả bài nộp và điểm số</p>
          </div>
        </a>
      </div>
    </div>
  );
}
