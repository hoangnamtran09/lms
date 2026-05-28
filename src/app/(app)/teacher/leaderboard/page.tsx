"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Medal, Clock, Gem, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalSeconds: number;
  totalDiamonds: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}p`;
  return `${m} phút`;
}

const PERIOD_LABELS: Record<string, string> = {
  week: "Tuần",
  month: "Tháng",
  all: "Tất cả",
};

export default function TeacherLeaderboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("week");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (user?.classId) params.set("classId", user.classId);

    api<LeaderboardEntry[]>(`/api/study-sessions/leaderboard?${params.toString()}`)
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [period, user?.classId]);

  const totalHours = entries.reduce((sum, e) => sum + e.totalSeconds, 0) / 3600;

  return (
    <div className="animate-fade-in max-w-4xl">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng xếp hạng lớp</h1>
          <p className="text-sm text-gray-500 mt-1">
            {entries.length} học sinh tham gia
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {Object.entries(PERIOD_LABELS).map(([key, label]) => (
          <Button
            key={key}
            variant={period === key ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} delay={80 + i * 80} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <Trophy className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có dữ liệu xếp hạng</p>
        </div>
      ) : (
        <>
          {/* Podium top 3 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 0, 2].map((idx) => {
              if (idx >= entries.length) return null;
              const entry = entries[idx];
              const pos = idx === 0 ? 1 : idx === 1 ? 0 : 2;
              const colors = [
                "from-amber-400 to-amber-500",
                "from-blue-400 to-blue-500",
                "from-orange-400 to-orange-500",
              ];
              const icons = [<Trophy className="size-5" />, <Medal className="size-5" />, <Medal className="size-5" />];
              return (
                <Card
                  key={entry.userId}
                  className={`rounded-2xl border-0 bg-gradient-to-b ${colors[pos]} text-white shadow-lg p-5 text-center`}
                >
                  <div className="flex justify-center mb-2">{icons[pos]}</div>
                  <p className="font-bold text-lg truncate">{entry.userName || "Học viên"}</p>
                  <p className="text-white/80 text-sm">{formatDuration(entry.totalSeconds)}</p>
                  <p className="text-white/70 text-xs flex items-center justify-center gap-1 mt-1">
                    <Gem className="size-3" /> {entry.totalDiamonds} KC
                  </p>
                </Card>
              );
            })}
          </div>

          {/* Full list */}
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
            <div className="divide-y">
              {entries.map((entry, i) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 px-5 py-3 ${
                    i === 0 ? "bg-amber-50" : i === 1 ? "bg-slate-50" : i === 2 ? "bg-orange-50" : ""
                  }`}
                >
                  <span className="w-8 text-center font-bold text-sm text-gray-500">#{i + 1}</span>
                  <span className="flex-1 font-medium text-gray-900 truncate">
                    {entry.userName || "Học viên"}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatDuration(entry.totalSeconds)}
                  </span>
                  <span className="text-sm text-gray-400 flex items-center gap-1 w-20">
                    <Gem className="size-3" />
                    {entry.totalDiamonds}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Summary */}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="size-4" /> {entries.length} người tham gia
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-4" /> {totalHours.toFixed(1)} giờ học
            </span>
          </div>
        </>
      )}
    </div>
  );
}
