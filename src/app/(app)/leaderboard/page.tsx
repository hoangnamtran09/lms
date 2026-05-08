"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Clock, Gem } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Entry {
  userId: string;
  userName: string;
  totalSeconds: number;
  totalDiamonds: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

const periods = [
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "all", label: "Tất cả" },
];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Entry[]>(`/api/study-sessions/leaderboard?period=${period}`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [period]);

  const getMedal = (pos: number) => {
    if (pos === 0) return <Medal className="size-5 text-amber-400" />;
    if (pos === 1) return <Medal className="size-5 text-gray-300" />;
    if (pos === 2) return <Medal className="size-5 text-amber-700" />;
    return <span className="w-5 text-center text-sm text-gray-400">{pos + 1}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng xếp hạng</h1>
          <p className="text-sm text-gray-500 mt-1">Học viên chăm chỉ nhất</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periods.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={period === p.key ? "default" : "ghost"}
              onClick={() => setPeriod(p.key)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <Trophy className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có dữ liệu cho kỳ này</p>
          <p className="text-sm text-gray-400 mt-1">Hãy bắt đầu học để xuất hiện trên bảng xếp hạng!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          {entries.map((entry, i) => (
            <div
              key={entry.userId}
              className={`flex items-center justify-between px-4 py-3 ${
                i < 3 ? "bg-amber-50/30" : ""
              } ${i < entries.length - 1 ? "border-b" : ""}`}
            >
              <div className="flex items-center gap-3">
                {getMedal(i)}
                <span className="font-medium text-gray-900">
                  {entry.userName || `Học viên ${entry.userId.slice(0, 8)}`}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDuration(entry.totalSeconds)}
                </span>
                {entry.totalDiamonds > 0 && (
                  <span className="flex items-center gap-1">
                    <Gem className="size-3" />
                    {entry.totalDiamonds}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
