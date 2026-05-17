"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock, Trophy, Gem, Flame, BookOpen, TrendingUp, Target,
  Star, ArrowUpRight, Medal, Activity, Sparkles, Play,
  BarChart3, Award, ChevronRight, Calendar,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TeacherDashboardPage from "./teacher/page";
import ParentDashboardPage from "./parent/page";

interface UserStats {
  totalStudySeconds: number;
  totalSessions: number;
  todaySeconds: number;
  weekSeconds: number;
  avgScore: number;
}

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalSeconds: number;
  totalDiamonds: number;
}

interface WeeklyDay {
  date: string;
  seconds: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

interface Course {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  gradeLevel: number;
  thumbnailUrl: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

function formatShortDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const DAILY_GOAL_SECONDS = 2 * 3600;
const WEEKLY_GOAL_SECONDS = 10 * 3600;
const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [diamondBalance, setDiamondBalance] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyChart, setWeeklyChart] = useState<WeeklyDay[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<UserStats>("/api/study-sessions/stats").catch(() => null),
      api<StreakInfo>("/api/streaks").catch(() => null),
      api<{ balance: number }>("/api/diamonds/balance").catch(() => ({ balance: 0 })),
      api<LeaderboardEntry[]>("/api/study-sessions/leaderboard?period=week").catch(() => []),
      api<WeeklyDay[]>("/api/study-sessions/weekly-chart").catch(() => []),
      api<Achievement[]>("/api/achievements/my").catch(() => []),
      api<Course[]>("/api/courses").catch(() => []),
    ]).then(([s, st, d, lb, wc, ach, cs]) => {
      setStats(s);
      setStreak(st);
      setDiamondBalance(d.balance);
      setLeaderboard(lb);
      setWeeklyChart(wc || []);
      setAchievements(ach || []);
      setCourses(cs || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton delay={0} className="h-12 w-64" />
        <Skeleton delay={80} className="h-6 w-96" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} delay={100 + i * 100} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton delay={500} className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton delay={600} className="h-80 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} delay={700 + i * 80} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const todayPct = stats ? Math.min(100, Math.round((stats.todaySeconds / DAILY_GOAL_SECONDS) * 100)) : 0;
  const weekPct = stats ? Math.min(100, Math.round((stats.weekSeconds / WEEKLY_GOAL_SECONDS) * 100)) : 0;
  const avgScoreVal = stats?.avgScore ? stats.avgScore.toFixed(1) : "0.0";

  const maxWeekSeconds = Math.max(...weeklyChart.map((d) => d.seconds), 1);
  const weekTotalSeconds = weeklyChart.reduce((sum, d) => sum + d.seconds, 0);

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 10);

  // Latest achievements — up to 4
  const latestAchievements = achievements.slice(0, 4);
  // Courses — up to 3
  const recentCourses = courses.slice(0, 3);

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Xin chào, <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              {user?.fullName || "Học viên"}
            </span>!
          </h1>
          {streak && streak.currentStreak >= 3 && (
            <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 text-xs font-bold shadow-lg shadow-orange-200">
              <Flame className="size-3.5 fill-white" />
              {streak.currentStreak} ngày streak!
            </div>
          )}
        </div>
        <p className="text-gray-500">
          {streak && streak.currentStreak > 0
            ? `🔥 Bạn đã học liên tục ${streak.currentStreak} ngày. Giữ vững phong độ!`
            : "Bắt đầu học hôm nay để tạo streak đầu tiên!"}
        </p>
      </div>

      {/* Progress rings + stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Daily ring */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Học hôm nay</p>
          <div className="relative size-24 mb-3">
            <svg viewBox="0 0 96 96" className="size-full -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="7" />
              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#g-today)" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={`${(todayPct / 100) * 251.3} 251.3`} />
              <defs>
                <linearGradient id="g-today" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-gray-900">{todayPct}%</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-800">{formatDuration(stats?.todaySeconds || 0)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Mục tiêu {formatShortDuration(DAILY_GOAL_SECONDS)}/ngày</p>
        </Card>

        {/* Weekly ring */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-col items-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tuần này</p>
          <div className="relative size-24 mb-3">
            <svg viewBox="0 0 96 96" className="size-full -rotate-90">
              <circle cx="48" cy="48" r="40" fill="none" stroke="#f3f4f6" strokeWidth="7" />
              <circle cx="48" cy="48" r="40" fill="none" stroke="url(#g-week)" strokeWidth="7"
                strokeLinecap="round" strokeDasharray={`${(weekPct / 100) * 251.3} 251.3`} />
              <defs>
                <linearGradient id="g-week" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-gray-900">{weekPct}%</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-gray-800">{formatDuration(stats?.weekSeconds || 0)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Mục tiêu {formatShortDuration(WEEKLY_GOAL_SECONDS)}/tuần</p>
        </Card>

        {/* Diamonds */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-xl shadow-violet-200 p-5">
          <div className="absolute -top-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/5 rounded-tl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center size-9 rounded-xl bg-white/20 backdrop-blur">
                <Gem className="size-4" />
              </div>
              <span className="text-xs font-medium text-violet-100">Kim cương</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">{diamondBalance.toLocaleString()}</p>
            <p className="text-[10px] text-violet-100 flex items-center gap-1">
              <Sparkles className="size-3" /> Hoàn thành bài tập để nhận thêm
            </p>
          </div>
        </Card>

        {/* Streak + Score */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl shadow-orange-200 p-5">
          <div className="absolute -top-4 -right-4 w-28 h-28 bg-white/10 rounded-full" />
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-white/5 rounded-tl-[60px]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center size-9 rounded-xl bg-white/20 backdrop-blur">
                <Flame className="size-4 fill-white" />
              </div>
              <span className="text-xs font-medium text-orange-100">Streak</span>
            </div>
            <p className="text-4xl font-extrabold tracking-tight mb-1">
              {streak?.currentStreak || 0} <span className="text-lg font-normal text-orange-100">ngày</span>
            </p>
            <p className="text-[10px] text-orange-100 flex items-center gap-1">
              <Trophy className="size-3" /> Kỷ lục: {streak?.longestStreak || 0} ngày
            </p>
          </div>
        </Card>
      </div>

      {/* Weekly chart + Leaderboard + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Weekly chart */}
        <Card className="lg:col-span-2 rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-emerald-100">
                <BarChart3 className="size-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Thời gian học tuần này</h3>
                <p className="text-xs text-gray-500">{formatDuration(weekTotalSeconds)} trong tuần</p>
              </div>
            </div>
          </div>
          {weeklyChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Calendar className="size-10 mb-2 opacity-50" />
              <p className="text-sm">Bắt đầu học để xem biểu đồ</p>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-1 sm:gap-2 h-52">
              {weeklyChart.map((day, i) => {
                const height = Math.max(4, Math.round((day.seconds / maxWeekSeconds) * 100));
                const date = new Date(day.date);
                const dayName = DAY_NAMES[date.getDay()];
                const isToday = new Date().toDateString() === date.toDateString();
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-500">{formatShortDuration(day.seconds)}</span>
                    <div className="w-full relative flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all duration-700 ease-out ${
                          isToday
                            ? "bg-gradient-to-t from-blue-500 to-blue-400 shadow-sm shadow-blue-200"
                            : "bg-gradient-to-t from-emerald-400 to-emerald-300"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                      {dayName}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Leaderboard compact */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center justify-center size-8 rounded-lg bg-amber-100">
              <Trophy className="size-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">BXH tuần</h3>
              <p className="text-xs text-gray-500">Thời gian học tập</p>
            </div>
          </div>
          {leaderboard.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Chưa có dữ liệu</div>
          ) : (
            <div className="flex-1 space-y-0.5">
              {leaderboard.slice(0, 8).map((entry, i) => (
                <div key={entry.userId}
                  className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
                    i === 0 ? "bg-amber-50" : i === 1 ? "bg-slate-50" : i === 2 ? "bg-orange-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`flex items-center justify-center size-6 rounded-full text-[10px] font-bold ${
                    i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-orange-500 text-white" : "text-gray-400"
                  }`}>
                    {i === 0 ? <Trophy className="size-3" /> : i === 1 ? <Medal className="size-3" /> : i === 2 ? <Medal className="size-3" /> : i + 1}
                  </div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{entry.userName || "Học viên"}</span>
                  <span className="text-xs text-gray-400">{formatShortDuration(entry.totalSeconds)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Achievements + Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Summary stats */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center size-8 rounded-lg bg-blue-100">
              <Target className="size-4 text-blue-600" />
            </div>
            <h4 className="font-bold text-gray-900 text-sm">Tổng kết</h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Clock className="size-3" /> Giờ học</span>
              <span className="text-xs font-bold text-gray-900">{formatDuration(stats?.totalStudySeconds || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Activity className="size-3" /> Buổi học</span>
              <span className="text-xs font-bold text-gray-900">{stats?.totalSessions || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><Star className="size-3" /> Điểm TB</span>
              <span className={`text-xs font-bold ${Number(avgScoreVal) >= 8 ? "text-emerald-600" : Number(avgScoreVal) >= 5 ? "text-amber-600" : "text-red-500"}`}>
                {avgScoreVal}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1.5"><TrendingUp className="size-3" /> Streak dài nhất</span>
              <span className="text-xs font-bold text-gray-900">{streak?.longestStreak || 0} ngày</span>
            </div>
          </div>
        </Card>

        {/* Achievements */}
        {latestAchievements.length > 0 ? (
          latestAchievements.map((a) => (
            <Card key={a.id} className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-200 text-xl flex-shrink-0">
                  {a.icon || "🏆"}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-gray-900 text-sm truncate">{a.title}</h4>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                </div>
              </div>
              <div className="mt-auto pt-3">
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                  <Award className="size-3 mr-1" /> Đã đạt được
                </Badge>
              </div>
            </Card>
          ))
        ) : (
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-col items-center justify-center text-center">
            <Award className="size-10 text-gray-300 mb-3" />
            <h4 className="font-bold text-gray-900 text-sm">Thành tựu</h4>
            <p className="text-xs text-gray-500 mt-1">Hoàn thành bài học để nhận huy hiệu</p>
          </Card>
        )}
      </div>

      {/* Recent courses + Continue learning */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="size-5 text-blue-600" />
              Tiếp tục học
            </h3>
            <Link href="/courses" className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
              Xem tất cả <ChevronRight className="size-3" />
            </Link>
          </div>
          {recentCourses.length === 0 ? (
            <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-8 text-center">
              <BookOpen className="size-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Chưa có khoá học nào</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {recentCourses.map((course) => (
                <Link key={course.id} href={`/courses/${course.subjectId}/${course.id}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all block"
                >
                  <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-blue-100 to-violet-100 text-blue-600 mb-3 group-hover:from-blue-200 group-hover:to-violet-200 transition-all">
                    <BookOpen className="size-5" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-blue-700 transition-colors line-clamp-2">
                    {course.title}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{course.description || "Không có mô tả"}</p>
                  <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
                    Vào học <ArrowUpRight className="size-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Truy cập nhanh</h3>
          <p className="text-xs text-gray-500 mb-5">Khám phá thêm</p>
          <div className="space-y-3 flex-1">
            <Link href="/courses"
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 transition-all group"
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-blue-500 text-white shadow-sm shadow-blue-200">
                <BookOpen className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Khoá học</p>
                <p className="text-[10px] text-gray-500">Khám phá các môn học</p>
              </div>
              <ArrowUpRight className="size-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
            </Link>
            <Link href="/assignments"
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 transition-all group"
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-amber-500 text-white shadow-sm shadow-amber-200">
                <Target className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Bài tập</p>
                <p className="text-[10px] text-gray-500">Làm bài &amp; nộp bài</p>
              </div>
              <ArrowUpRight className="size-4 text-amber-400 group-hover:text-amber-600 transition-colors" />
            </Link>
            <Link href="/leaderboard"
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-50 to-violet-100 hover:from-violet-100 hover:to-violet-200 transition-all group"
            >
              <div className="flex items-center justify-center size-9 rounded-lg bg-violet-500 text-white shadow-sm shadow-violet-200">
                <Trophy className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">Xếp hạng</p>
                <p className="text-[10px] text-gray-500">Bảng xếp hạng toàn trường</p>
              </div>
              <ArrowUpRight className="size-4 text-violet-400 group-hover:text-violet-600 transition-colors" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user && (user.role === "TEACHER" || user.role === "ADMIN" || user.role === "SUPER_ADMIN")) {
    return <TeacherDashboardPage />;
  }
  if (user?.role === "PARENT") {
    return <ParentDashboardPage />;
  }

  return <StudentDashboard />;
}
