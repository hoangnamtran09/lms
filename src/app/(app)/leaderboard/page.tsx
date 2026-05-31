"use client";

import { useEffect, useState } from "react";

import { Trophy, Clock, Gem, Crown, Star, Sparkles, Zap, Flame, Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  { key: "week", label: "Hàng tuần" },
  { key: "month", label: "Hàng tháng" },
  { key: "all", label: "Mọi thời đại" },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const totalHours = Math.round(totalTime / 360) / 10;
  const maxTime = entries.length > 0 ? entries[0].totalSeconds : 1;
  const [motto] = useState(() => messages[Math.floor(Math.random() * messages.length)]);

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
    <div className="animate-fade-in max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      {/* ---- Header ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-primary mb-1">
            Bảng xếp hạng học sinh
          </h2>
          <p className="text-base text-gray-500">Cập nhật vinh danh những cá nhân xuất sắc nhất.</p>
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
            return (
              <div key={`empty-${idx}`} className="flex flex-col items-center gap-2 opacity-40">
                <Avatar size={idx === 1 ? "lg" : "default"} className="ring-2 ring-gray-200">
                  <AvatarFallback>—</AvatarFallback>
                </Avatar>
                <div className={`w-full ${idx === 1 ? "h-40" : idx === 0 ? "h-32" : "h-28"} rounded-2xl bg-gradient-to-b ${idx === 1 ? "from-blue-100 to-blue-200" : idx === 0 ? "from-gray-100 to-gray-200" : "from-amber-100 to-amber-200"} flex items-center justify-center`}>
                  <span className="text-gray-400">{idx === 1 ? "#1" : idx === 0 ? "#2" : "#3"}</span>
                </div>
              </div>
            );
          }

          const rank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
          const isMe = entry.userId === currentUserId;
          const isFirst = rank === 1;
          const isSecond = rank === 2;

          return (
            <div key={entry.userId || `entry-${idx}`} className={`flex flex-col items-center gap-2 animate-slide-up [animation-delay:${idx * 150}ms]`}>
              {/* Avatar */}
              <div className={`rounded-full ${isFirst ? "p-1 bg-gradient-to-b from-yellow-300 to-amber-400 size-20" : isSecond ? "p-1 bg-gradient-to-b from-gray-200 to-gray-400 size-16" : "p-1 bg-gradient-to-b from-amber-400 to-amber-600 size-16"}`}>
                <Avatar size={isFirst ? "lg" : "default"} className="size-full">
                  <AvatarFallback className={`text-lg font-bold bg-white ${isFirst ? "text-yellow-700" : isSecond ? "text-gray-500" : "text-amber-800"}`}>
                    {initials(entry.userName)}
                  </AvatarFallback>
                </Avatar>
              </div>
              {isMe && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Bạn</Badge>}
              {/* Name */}
              <span className={`text-sm font-semibold text-center leading-tight ${isMe ? "text-primary" : "text-gray-900"}`}>
                {entry.userName || `HV ${entry.userId.slice(0, 8)}`}
              </span>
              {/* Label */}
              <span className="text-xs text-gray-500">
                {rank === 1 ? "Quán quân" : rank === 2 ? "Á quân" : "Quý quân"}
              </span>
              {/* Podium block */}
              <div className={`w-full ${isFirst ? "h-44" : isSecond ? "h-36" : "h-32"} rounded-2xl bg-gradient-to-b ${isFirst ? "from-primary to-blue-600" : isSecond ? "from-gray-200 to-gray-400" : "from-amber-400 to-amber-600"} flex flex-col items-center justify-center gap-1 relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 rounded-2xl" />
                {rank === 1 ? <Crown className="size-6 text-yellow-300 drop-shadow-sm relative z-10" /> :
                 rank === 2 ? <Star className="size-5 text-white/70 drop-shadow-sm relative z-10" /> :
                 <Sparkles className="size-5 text-white/70 drop-shadow-sm relative z-10" />}
                <span className={`text-2xl font-black ${isFirst ? "text-white" : isSecond ? "text-gray-600" : "text-amber-900"} relative z-10`}>#{rank}</span>
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
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-8">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h4 className="text-lg font-semibold text-gray-900">Thứ hạng chi tiết</h4>
          <span className="text-sm text-gray-500">Hiển thị {Math.min(entries.length, 20)} học sinh hàng đầu</span>
        </div>

        {/* Desktop header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
          <div className="col-span-1">Hạng</div>
          <div className="col-span-4">Học sinh</div>
          <div className="col-span-2">Thời gian</div>
          <div className="col-span-2">Kim cương</div>
          <div className="col-span-2">Xu hướng</div>
          <div className="col-span-1 text-center">Xem</div>
        </div>

        <div className="divide-y divide-gray-100">
          {rest.length > 0 ? (
            rest.map((entry, i) => {
              const rank = i + 4;
              const isMe = entry.userId === currentUserId;
              const pct = maxTime > 0 ? (entry.totalSeconds / maxTime) * 100 : 0;
              const trend = i % 3 === 0 ? "up" : i % 3 === 1 ? "stable" : "down";

              return (
                <div
                  key={entry.userId}
                  className={`grid grid-cols-2 md:grid-cols-12 gap-4 px-4 sm:px-6 py-3 items-center hover:bg-gray-50/70 transition-colors ${
                    isMe ? "bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                >
                  {/* Rank */}
                  <span className="text-sm font-bold text-primary md:col-span-1">
                    {String(rank).padStart(2, "0")}
                  </span>

                  {/* Student */}
                  <div className="flex items-center gap-3 md:col-span-4">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarFallback className={`text-xs ${isMe ? "bg-primary/10 text-primary" : ""}`}>
                        {initials(entry.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-gray-900"}`}>
                          {entry.userName || `Học viên ${entry.userId.slice(0, 8)}`}
                        </span>
                        {isMe && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Bạn</Badge>}
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isMe ? "bg-primary" : "bg-gradient-to-r from-amber-300 to-amber-500"
                          }`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time */}
                  <div className="text-sm font-medium text-gray-700 md:col-span-2 flex items-center gap-1">
                    <Clock className="size-3 text-gray-400" />
                    {formatHours(entry.totalSeconds)}
                  </div>

                  {/* Diamonds */}
                  <div className="text-sm font-medium text-gray-700 md:col-span-2 flex items-center gap-1">
                    <Gem className="size-3 text-amber-400" />
                    {entry.totalDiamonds || 0}
                  </div>

                  {/* Trend */}
                  <div className="text-sm md:col-span-2">
                    {trend === "up" ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <TrendingUp className="size-3.5" />
                        <span className="text-xs font-medium">+{(rank % 5) + 1}</span>
                      </div>
                    ) : trend === "down" ? (
                      <div className="flex items-center gap-1 text-red-500">
                        <TrendingDown className="size-3.5" />
                        <span className="text-xs font-medium">-{(rank % 3) + 1}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <Minus className="size-3.5" />
                        <span className="text-xs font-medium">0</span>
                      </div>
                    )}
                  </div>

                  {/* View button */}
                  <div className="md:col-span-1 flex justify-center">
                    <button className="p-2 text-gray-400 hover:text-primary transition-colors rounded-lg hover:bg-gray-100">
                      <TrendingUp className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              Chỉ có {entries.length} người tham gia trong kỳ này.
            </div>
          )}

          {myEntry && myRank <= 3 && (
            <div className="px-6 py-4 bg-primary/5 border-t border-primary/10">
              <p className="text-sm text-primary font-medium text-center">
                Bạn đang ở vị trí #{myRank} — xuất sắc! Tiếp tục phát huy nhé!
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-center">
          <button className="flex items-center gap-2 text-primary font-medium text-sm hover:underline transition-all">
            Xem thêm tất cả bảng xếp hạng
            <TrendingUp className="size-4" />
          </button>
        </div>
      </div>

      {/* ---- Stats Summary ---- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
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
