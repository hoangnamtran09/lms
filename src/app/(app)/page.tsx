"use client";

import { useEffect, useState } from "react";
import { Clock, Trophy, Gem, Flame, BookOpen } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [diamondBalance, setDiamondBalance] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<UserStats>("/api/study-sessions/stats").catch(() => null),
      api<StreakInfo>("/api/streaks").catch(() => null),
      api<{ balance: number }>("/api/diamonds/balance").catch(() => ({ balance: 0 })),
      api<LeaderboardEntry[]>("/api/study-sessions/leaderboard?period=week").catch(() => []),
    ]).then(([s, st, d, lb]) => {
      setStats(s);
      setStreak(st);
      setDiamondBalance(d.balance);
      setLeaderboard(lb);
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: "Học hôm nay", value: formatDuration(stats?.todaySeconds || 0), icon: Clock },
    { label: "Học tuần này", value: formatDuration(stats?.weekSeconds || 0), icon: BookOpen },
    { label: "Kim cương", value: `${diamondBalance}`, icon: Gem },
    { label: "Streak", value: streak ? `${streak.currentStreak} ngày` : "0 ngày", icon: Flame },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Xin chào, {user?.fullName || "Học viên"}!
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {streak && streak.currentStreak > 0
          ? `Bạn đã học liên tục ${streak.currentStreak} ngày. Tiếp tục phát huy!`
          : "Bắt đầu học để tạo streak!"}
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label} className="rounded-xl ring-1 ring-foreground/10">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <stat.icon className="size-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              Bảng xếp hạng tuần
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 10).map((entry, i) => (
                  <div key={entry.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 text-center font-bold ${i < 3 ? "text-amber-500" : "text-gray-400"}`}>
                        {i + 1}
                      </span>
                      <span className="text-gray-900">{entry.userName || "Học viên"}</span>
                    </div>
                    <span className="text-gray-500">{formatDuration(entry.totalSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats summary */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">Tổng kết</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tổng thời gian học</span>
                  <span className="font-medium">{formatDuration(stats?.totalStudySeconds || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Số buổi học</span>
                  <span className="font-medium">{stats?.totalSessions || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Điểm trung bình</span>
                  <span className="font-medium">{(stats?.avgScore || 0).toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Streak dài nhất</span>
                  <span className="font-medium">{streak?.longestStreak || 0} ngày</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
