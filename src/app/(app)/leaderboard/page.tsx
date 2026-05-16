"use client";

import { useEffect, useState, useMemo } from "react";
import { Trophy, Clock, Gem, Crown, Star, Sparkles, Zap, Flame, Users, TrendingUp, ChevronUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Entry {
  userId: string;
  userName: string;
  totalSeconds: number;
  totalDiamonds: number;
}

// ---- helpers ----

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 1) return `${h}.${Math.round(m / 6)} giờ`;
  if (m >= 1) return `${m} phút`;
  return `${seconds}s`;
}

function initials(name: string | undefined): string {
  if (!name || name.trim().length === 0) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function gapToNext(entries: Entry[], index: number): number {
  if (index <= 0) return 0;
  return entries[index - 1].totalSeconds - entries[index].totalSeconds;
}

function gapMsg(seconds: number, nextRank: number): string {
  if (seconds <= 0) return `Bạn sắp vượt qua hạng ${nextRank}!`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `Chỉ cần thêm ${h}.${Math.round(m / 6)} giờ để vượt qua hạng ${nextRank}!`;
  return `Chỉ cần thêm ${m} phút để vượt qua hạng ${nextRank}!`;
}

const messages = [
  "Mỗi giờ học là một bước tiến đến thành công!",
  "Kiên trì hôm nay, vinh quang ngày mai!",
  "Người giỏi nhất cũng từng là người mới bắt đầu!",
  "Học tập là chìa khoá mở cánh cửa tương lai!",
  "Đừng so sánh với người khác — hãy vượt qua chính mình!",
];

const periods = [
  { key: "week", label: "Tuần" },
  { key: "month", label: "Tháng" },
  { key: "all", label: "Tất cả" },
];

// ---- podium config ----

const podiumConfig = [
  { rank: 1, color: "from-amber-300 via-yellow-400 to-amber-400", badge: "bg-gradient-to-b from-yellow-400 to-amber-500", border: "ring-amber-300", text: "text-yellow-700", h: "h-40", icon: Crown, label: "Quán quân" },
  { rank: 2, color: "from-gray-200 via-gray-300 to-gray-400", badge: "bg-gradient-to-b from-gray-300 to-gray-400", border: "ring-gray-300", text: "text-gray-600", h: "h-32", icon: Star, label: "Á quân" },
  { rank: 3, color: "from-amber-500 via-amber-600 to-amber-700", badge: "bg-gradient-to-b from-amber-500 to-amber-600", border: "ring-amber-500", text: "text-amber-800", h: "h-28", icon: Sparkles, label: "Quý quân" },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
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

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const currentUserId = user?.id;
  const myEntry = entries.find((e) => e.userId === currentUserId);
  const myRank = myEntry ? entries.indexOf(myEntry) + 1 : -1;
  const myGap = myRank > 1 ? gapToNext(entries, entries.indexOf(myEntry!)) : 0;
  const totalTime = entries.reduce((s, e) => s + e.totalSeconds, 0);
  const totalHours = Math.round(totalTime / 360) / 10; // one decimal
  const maxTime = entries.length > 0 ? entries[0].totalSeconds : 1;
  const motto = useMemo(() => messages[Math.floor(Math.random() * messages.length)], []);

  // Podium order: #2 - #1 - #3
  const podiumEntries = [
    top3[1], // #2
    top3[0], // #1
    top3[2], // #3
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Skeleton delay={0} className="h-8 w-48" />
            <Skeleton delay={50} className="h-4 w-64 mt-2" />
          </div>
          <Skeleton delay={100} className="h-9 w-48 rounded-lg" />
        </div>
        {/* Podium skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} delay={80 + i * 60} className={`${i === 1 ? "h-40" : i === 2 ? "h-32" : "h-28"} w-full rounded-2xl`} />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} delay={200 + i * 60} className="h-14 w-full rounded-lg mb-2" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="animate-fade-in">
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
        <div className="text-center py-20 bg-white rounded-2xl border">
          <Trophy className="size-16 text-gray-200 mx-auto mb-5" />
          <p className="text-lg font-semibold text-gray-500 mb-1">Chưa có dữ liệu cho kỳ này</p>
          <p className="text-sm text-gray-400">Hãy bắt đầu học để trở thành người dẫn đầu!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="size-6 text-amber-500" />
            Bảng xếp hạng
          </h1>
          <p className="text-sm text-gray-500 mt-1">Đấu trường học tập — Ai là người chăm chỉ nhất?</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start">
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

      {/* ---- Hero Podium ---- */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8 items-end">
        {podiumEntries.map((entry, i) => {
          const idx = i; // 0=#2, 1=#1, 2=#3
          if (!entry) {
            const cfg = podiumConfig[idx === 0 ? 1 : idx === 1 ? 0 : 2];
            return (
              <div key={`empty-${idx}`} className="flex flex-col items-center gap-2 opacity-40">
                <div className={`w-full ${cfg.h} rounded-2xl bg-gradient-to-b ${cfg.color} flex items-center justify-center`}>
                  <span className="text-4xl">—</span>
                </div>
              </div>
            );
          }

          const cfg = idx === 0 ? podiumConfig[1] : idx === 1 ? podiumConfig[0] : podiumConfig[2];
          const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const isMe = entry.userId === currentUserId;
          const delay = `animate-slide-up [animation-delay:${idx * 150}ms]`;

          return (
            <div key={entry.userId || `empty-${idx}`} className={`flex flex-col items-center gap-2 ${delay}`}>
              {/* Avatar */}
              <div className={`rounded-full p-1 bg-gradient-to-b ${cfg.color} ${rank === 1 ? "size-20" : "size-16"}`}>
                <Avatar size={rank === 1 ? "lg" : "default"} className="size-full">
                  <AvatarFallback className={`text-lg font-bold bg-white ${cfg.text}`}>
                    {initials(entry.userName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {isMe && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Bạn</Badge>}
              {/* Name */}
              <span className={`text-sm font-semibold text-center leading-tight ${isMe ? "text-primary" : "text-gray-900"}`}>
                {entry.userName || `HV ${entry.userId.slice(0, 8)}`}
              </span>
              {/* Podium block */}
              <div className={`w-full ${cfg.h} rounded-2xl bg-gradient-to-b ${cfg.color} flex flex-col items-center justify-center gap-1 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 rounded-2xl" />
                <cfg.icon className={`${rank === 1 ? "size-6 text-yellow-600" : rank === 2 ? "size-5 text-gray-500" : "size-5 text-amber-200"} drop-shadow-sm relative z-10`} />
                <span className={`text-2xl font-black ${cfg.text} relative z-10`}>#{rank}</span>
                <span className="text-xs font-medium text-white/80 relative z-10">{cfg.label}</span>
                <div className="flex items-center gap-2 mt-1 relative z-10">
                  <span className="text-xs font-semibold text-white/90 flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatHours(entry.totalSeconds)}
                  </span>
                  {entry.totalDiamonds > 0 && (
                    <span className="text-xs font-semibold text-white/90 flex items-center gap-1">
                      <Gem className="size-3" />
                      {entry.totalDiamonds}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Your Position Card (if not in top 3) ---- */}
      {myEntry && myRank > 3 && (
        <div className="mb-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20 p-4 sm:p-5 animate-slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="size-12 rounded-full bg-primary/10 ring-2 ring-primary/30 flex items-center justify-center">
                <span className="text-xl font-black text-primary">#{myRank}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Vị trí của bạn</p>
                <p className="text-xs text-gray-500">
                  {formatHours(myEntry.totalSeconds)} học tập
                  {myEntry.totalDiamonds > 0 && ` • ${myEntry.totalDiamonds} kim cương`}
                </p>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                <TrendingUp className="size-4" />
                {gapMsg(myGap, myRank - 1)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- Full Rankings (4th+) ---- */}
      {rest.length > 0 && (
        <div className="bg-white rounded-2xl border overflow-hidden mb-6">
          <div className="px-4 py-3 border-b bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bảng xếp hạng đầy đủ</p>
          </div>
          <div className="divide-y">
            {rest.map((entry, i) => {
              const rank = i + 4;
              const isMe = entry.userId === currentUserId;
              const pct = maxTime > 0 ? (entry.totalSeconds / maxTime) * 100 : 0;

              return (
                <div
                  key={entry.userId}
                  className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50/70 transition-colors ${
                    isMe ? "bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                >
                  {/* Rank */}
                  <span className="w-7 text-center text-sm font-semibold text-gray-400 shrink-0">
                    {rank}
                  </span>
                  {/* Avatar */}
                  <Avatar size="sm" className="shrink-0">
                    <AvatarFallback className={`text-xs ${isMe ? "bg-primary/10 text-primary" : ""}`}>
                      {initials(entry.userName)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-gray-900"}`}>
                        {entry.userName || `Học viên ${entry.userId.slice(0, 8)}`}
                      </span>
                      {isMe && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Bạn</Badge>}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isMe ? "bg-primary" : "bg-gradient-to-r from-amber-300 to-amber-500"
                        }`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatHours(entry.totalSeconds)}
                    </span>
                    {entry.totalDiamonds > 0 && (
                      <span className="flex items-center gap-1">
                        <Gem className="size-3" />
                        {entry.totalDiamonds}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Stats Summary ---- */}
      <div className="bg-white rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="size-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Users className="size-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{entries.length}</p>
            <p className="text-xs text-gray-500">Người tham gia</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Flame className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{totalHours}</p>
            <p className="text-xs text-gray-500">Tổng giờ học</p>
          </div>
        </div>
        <div className="flex-1 hidden sm:block" />
        <div className="flex items-center gap-2 text-sm italic text-gray-500">
          <Zap className="size-4 text-amber-400 shrink-0" />
          {motto}
        </div>
      </div>
    </div>
  );
}
