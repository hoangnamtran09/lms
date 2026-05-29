"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ClipboardList, Clock, Sparkles, TrendingUp, BookOpen, ArrowUpRight, GraduationCap, Flame, FileText, Bell } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

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
  if (h > 0) return `${h}h ${m}p`;
  return `${m} phút`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Chờ chấm", className: "bg-amber-100 text-amber-700 border-amber-200" },
  GRADED: { label: "Đã chấm", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  RETURNED: { label: "Đã trả", className: "bg-blue-100 text-blue-700 border-blue-200" },
  LATE: { label: "Trễ hạn", className: "bg-red-100 text-red-700 border-red-200" },
};

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>("/api/teacher/dashboard")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton delay={0} className="h-10 w-72" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} delay={80 + i * 100} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton delay={400} className="h-80 rounded-2xl" />
          <Skeleton delay={500} className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <GraduationCap className="size-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">Không thể tải dữ liệu</p>
        <p className="text-sm mt-1">Vui lòng thử lại sau</p>
      </div>
    );
  }

  const activeStudents = data.students.filter((s) => s.totalStudy > 0);
  const totalStudyHours = Math.round(
    data.students.reduce((sum, s) => sum + s.totalStudy, 0) / 3600
  );

  return (
    <div className="animate-fade-in pb-8">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-6 lg:p-8 mb-8 shadow-2xl shadow-purple-200/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">
              {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
              Xin chào, {user?.fullName || "Giáo viên"}
            </h1>
            <p className="text-white/80 text-sm lg:text-base max-w-md">
              Bạn có{" "}
              <span className="font-bold text-amber-200">{data.pendingGrading} bài</span>{" "}
              đang chờ chấm và{" "}
              <span className="font-bold text-emerald-200">{activeStudents.length} học sinh</span>{" "}
              đang hoạt động
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/teacher/assignments">
              <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm rounded-xl">
                <FileText className="size-4" /> Tạo bài tập mới
              </Button>
            </Link>
            <Link href="/teacher/attendance">
              <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm rounded-xl">
                <Clock className="size-4" /> Điểm danh
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-xl shadow-blue-200 p-5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20">
                <Users className="size-5" />
              </div>
              <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Học sinh</span>
            </div>
            <p className="text-3xl font-bold">{data.students.length}</p>
            <p className="text-sm text-white/70 mt-1">
              {activeStudents.length} đang hoạt động
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-200 p-5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20">
                <Clock className="size-5" />
              </div>
              <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Chờ chấm bài</span>
            </div>
            <p className="text-3xl font-bold">{data.pendingGrading}</p>
            <p className="text-sm text-white/70 mt-1">
              {data.pendingGrading > 0 ? "Cần xử lý ngay" : "Đã chấm hết"}
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-200 p-5">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-white/20">
                <ClipboardList className="size-5" />
              </div>
              <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Bài tập đã tạo</span>
            </div>
            <p className="text-3xl font-bold">{data.assignmentCount}</p>
            <p className="text-sm text-white/70 mt-1">
              Tổng {totalStudyHours}h học của lớp
            </p>
          </div>
        </Card>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Students — 3 cols */}
        <Card className="lg:col-span-3 rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900">Học sinh của bạn</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                {data.students.length} học sinh trong lớp
              </p>
            </div>
            <Link href="/teacher/students">
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
                Xem tất cả <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Users className="size-12 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Chưa có học sinh nào</p>
                <p className="text-xs mt-1">Học sinh sẽ xuất hiện khi được phân vào lớp của bạn</p>
              </div>
            ) : (
              <div className="divide-y">
                {data.students.slice(0, 8).map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex items-center justify-center size-9 rounded-xl text-sm font-bold shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${["#e0e7ff","#fce7f3","#d1fae5","#fef3c7","#ede9fe","#cffafe","#ffe4e6","#e0e7ff"][i % 8]}, ${["#c7d2fe","#fbcfe8","#a7f3d0","#fde68a","#ddd6fe","#a5f3fc","#fecdd3","#c7d2fe"][i % 8]})`,
                          color: ["#4338ca","#be185d","#047857","#b45309","#6d28d9","#0e7490","#be123c","#4338ca"][i % 8],
                        }}
                      >
                        {s.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.fullName}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <BookOpen className="size-3" />
                            {formatDuration(s.totalStudy)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      {s.streak > 0 && (
                        <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                          <Flame className="size-3 fill-orange-500 text-orange-500" />
                          {s.streak}
                        </div>
                      )}
                      <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-500"
                          style={{ width: `${Math.min(100, (s.totalStudy / 3600) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Submissions — 2 cols */}
        <Card className="lg:col-span-2 rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Bài nộp gần đây
                {data.pendingGrading > 0 && (
                  <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px] px-1.5 py-0">
                    {data.pendingGrading} mới
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Cần chấm và phản hồi</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bell className="size-12 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Chưa có bài nộp nào</p>
                <p className="text-xs mt-1">Bài nộp sẽ xuất hiện khi học sinh gửi bài</p>
              </div>
            ) : (
              <div className="divide-y">
                {data.recentSubmissions.map((sub, i) => {
                  const cfg = statusConfig[sub.status] || { label: sub.status, className: "bg-gray-100 text-gray-600 border-gray-200" };
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-sm font-medium text-gray-900 truncate">{sub.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {sub.studentName} · {timeAgo(sub.submittedAt)}
                        </p>
                      </div>
                      <Badge className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${cfg.className}`}>
                        {cfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Actions ── */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tạo bài tập", href: "/teacher/assignments", icon: FileText, gradient: "from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100", textColor: "text-indigo-700", iconBg: "bg-indigo-100 text-indigo-600" },
          { label: "Điểm danh", href: "/teacher/attendance", icon: Clock, gradient: "from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100", textColor: "text-emerald-700", iconBg: "bg-emerald-100 text-emerald-600" },
          { label: "Xem bảng xếp hạng", href: "/teacher/leaderboard", icon: TrendingUp, gradient: "from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100", textColor: "text-amber-700", iconBg: "bg-amber-100 text-amber-600" },
          { label: "Quản lý điểm yếu", href: "/teacher/mistakes", icon: Sparkles, gradient: "from-violet-50 to-purple-50 hover:from-violet-100 hover:to-purple-100", textColor: "text-violet-700", iconBg: "bg-violet-100 text-violet-600" },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <div className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${action.gradient} transition-all group cursor-pointer ring-1 ring-gray-100`}>
              <div className={`flex items-center justify-center size-10 rounded-xl ${action.iconBg} group-hover:scale-110 transition-transform`}>
                <action.icon className="size-5" />
              </div>
              <span className={`text-sm font-semibold ${action.textColor}`}>{action.label}</span>
              <ArrowUpRight className="size-4 text-gray-400 ml-auto group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
