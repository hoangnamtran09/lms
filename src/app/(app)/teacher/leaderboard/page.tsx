"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth/auth-provider";
import { MaterialIcon } from "@/components/ui/material-icon";

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

  const top3 = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);
  const maxTime = entries.length > 0 ? entries[0].totalSeconds : 1;

  const totalDiamonds = useMemo(
    () => entries.reduce((sum, e) => sum + e.totalDiamonds, 0),
    [entries]
  );
  const avgMinutes =
    entries.length > 0
      ? Math.round(entries.reduce((sum, e) => sum + e.totalSeconds, 0) / entries.length / 60)
      : 0;

  // Podium order: #2 (left), #1 (center), #3 (right)
  const podium: (LeaderboardEntry | undefined)[] = [
    top3[1], // rank 2
    top3[0], // rank 1
    top3[2], // rank 3
  ];

  const podiumThemes = [
    {
      rank: 2,
      label: "Á quân",
      gradient: "from-blue-500 to-blue-600",
      glow: "0 20px 40px -15px rgba(37, 99, 235, 0.3)",
      border: "border-blue-200/40",
      badgeBg: "bg-blue-500",
      badgeIcon: "workspace_premium",
      textColor: "text-blue-600",
      dotColor: "bg-blue-500/5",
    },
    {
      rank: 1,
      label: "Quán quân",
      gradient: "from-amber-400 to-amber-500",
      glow: "0 20px 40px -15px rgba(255, 193, 7, 0.4)",
      border: "border-amber-300/60",
      badgeBg: "bg-amber-400",
      badgeIcon: "military_tech",
      textColor: "text-amber-600",
      dotColor: "bg-amber-500/10",
    },
    {
      rank: 3,
      label: "Quý quân",
      gradient: "from-orange-400 to-orange-500",
      glow: "0 20px 40px -15px rgba(249, 115, 22, 0.3)",
      border: "border-orange-200/40",
      badgeBg: "bg-orange-500",
      badgeIcon: "workspace_premium",
      textColor: "text-orange-600",
      dotColor: "bg-orange-500/5",
    },
  ];

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <Skeleton delay={0} className="h-5 w-20 mb-2" />
          <Skeleton delay={50} className="h-9 w-64 mb-2" />
          <Skeleton delay={80} className="h-5 w-72" />
        </div>
        <div className="flex gap-2 mb-6">
          <Skeleton delay={100} className="h-10 w-20 rounded-xl" />
          <Skeleton delay={120} className="h-10 w-20 rounded-xl" />
          <Skeleton delay={140} className="h-10 w-20 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              delay={150 + i * 60}
              className={`${i === 1 ? "h-64" : "h-56"} w-full rounded-3xl`}
            />
          ))}
        </div>
        <Skeleton delay={300} className="h-96 w-full rounded-3xl mb-6" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} delay={350 + i * 40} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="animate-fade-in">
        <Link
          href="/teacher"
          className="inline-flex items-center gap-1 text-primary font-medium text-sm hover:underline mb-2"
        >
          <MaterialIcon name="arrow_back" className="text-sm" />
          Quay lại
        </Link>
        <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-1">
          Bảng xếp hạng lớp
        </h2>
        <p className="text-gray-500 mb-6">0 học sinh tham gia</p>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-8">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                period === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-200">
          <MaterialIcon name="leaderboard" className="text-5xl text-gray-200 mb-4 block" />
          <p className="text-lg font-semibold text-gray-500 mb-1">
            Chưa có dữ liệu xếp hạng
          </p>
          <p className="text-sm text-gray-400">
            Học sinh hãy bắt đầu học để xuất hiện trên bảng xếp hạng!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ---- Header ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <Link
            href="/teacher"
            className="inline-flex items-center gap-1 text-primary font-medium text-sm hover:underline mb-2"
          >
            <MaterialIcon name="arrow_back" className="text-sm" />
            Quay lại
          </Link>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">
            Bảng xếp hạng lớp
          </h2>
          <p className="text-gray-500 mt-1">
            {entries.length} học sinh tham gia • Cập nhật lần cuối: vừa xong
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-2xl p-1 w-fit">
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                period === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Podium Section ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-12">
        {podium.map((entry, i) => {
          const theme = podiumThemes[i];
          const isFirst = theme.rank === 1;

          if (!entry) {
            return (
              <div
                key={`empty-${i}`}
                className={`flex flex-col items-center gap-3 opacity-30 ${isFirst ? "order-1 md:order-2" : i === 0 ? "order-2 md:order-1" : "order-3 md:order-3"}`}
              >
                <div className="w-20 h-20 rounded-full bg-gray-100" />
                <div
                  className={`w-full ${isFirst ? "h-56" : "h-48"} rounded-3xl bg-gray-100 flex items-center justify-center`}
                >
                  <span className="text-gray-400 text-4xl font-black">#{theme.rank}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={entry.userId}
              className={`flex flex-col items-center ${isFirst ? "order-1 md:order-2" : i === 0 ? "order-2 md:order-1" : "order-3 md:order-3"} animate-slide-up`}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div
                className={`w-full bg-white rounded-3xl p-6 border relative overflow-hidden group transition-transform hover:-translate-y-2 duration-300 ${
                  isFirst ? "scale-105 border-amber-300/60" : theme.border
                }`}
                style={{ boxShadow: theme.glow }}
              >
                {/* Decorative dot */}
                <div
                  className={`absolute -top-12 -right-12 w-24 h-24 rounded-full blur-2xl ${theme.dotColor} group-hover:opacity-100 transition-opacity`}
                />
                {/* Watermark rank */}
                <span
                  className={`absolute top-4 left-4 font-black text-4xl ${isFirst ? "text-6xl" : ""} select-none ${
                    isFirst ? "text-amber-400/15" : "text-gray-300/20"
                  }`}
                >
                  #{theme.rank}
                </span>

                <div className="flex flex-col items-center text-center relative z-10">
                  {/* Avatar */}
                  <div className={`relative ${isFirst ? "mb-5" : "mb-4"}`}>
                    <div
                      className={`rounded-full bg-gradient-to-b ${theme.gradient} p-0.5 ${
                        isFirst ? "w-28 h-28" : "w-20 h-20"
                      }`}
                    >
                      <div
                        className={`w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-gray-600 ${
                          isFirst ? "text-2xl" : "text-lg"
                        }`}
                      >
                        {entry.userName
                          ? entry.userName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "?"}
                      </div>
                    </div>
                    {/* Rank badge */}
                    <div
                      className={`absolute ${isFirst ? "-bottom-1 left-1/2 -translate-x-1/2 w-10 h-10" : "-bottom-1 -right-1 w-8 h-8"} ${theme.badgeBg} rounded-full flex items-center justify-center text-white border-2 border-white shadow-md ${isFirst ? "animate-bounce" : ""}`}
                    >
                      <MaterialIcon
                        name={theme.badgeIcon}
                        filled
                        className={isFirst ? "text-lg" : "text-sm"}
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className={`font-semibold mb-1 ${isFirst ? "text-xl" : "text-lg"} text-gray-900`}>
                    {entry.userName || "Học viên"}
                  </h3>
                  <p className="text-xs text-gray-400 mb-1">
                    {theme.rank === 1 ? "Quán quân" : theme.rank === 2 ? "Á quân" : "Quý quân"}
                  </p>

                  {/* Time */}
                  <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-3">
                    <MaterialIcon name="schedule" className="text-sm" />
                    {formatDuration(entry.totalSeconds)}
                  </div>

                  {/* Diamonds badge */}
                  <div
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${
                      isFirst
                        ? "bg-amber-400 text-gray-900 border-amber-300 shadow-[0_10px_20px_-5px_rgba(255,193,7,0.4)]"
                        : `bg-primary/10 text-primary border-primary/20`
                    }`}
                  >
                    <MaterialIcon name="diamond" filled className={isFirst ? "text-gray-900" : "text-primary"} />
                    <span className="font-bold">{entry.totalDiamonds.toLocaleString()} KC</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Detailed Ranking Table ---- */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h4 className="text-lg font-semibold text-gray-900">Bảng chi tiết xếp hạng</h4>
          <button className="text-primary font-semibold text-sm hover:underline flex items-center gap-1">
            Tải báo cáo
            <MaterialIcon name="download" className="text-base" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <th className="px-6 py-4 w-20">Hạng</th>
                <th className="px-6 py-4">Học sinh</th>
                <th className="px-6 py-4 text-right">Thời gian học</th>
                <th className="px-6 py-4 text-right">Kim cương</th>
                <th className="px-6 py-4 text-right">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry, i) => {
                const rank = i + 1;
                const pct = maxTime > 0 ? Math.round((entry.totalSeconds / maxTime) * 100) : 0;
                const isTop3 = rank <= 3;

                return (
                  <tr
                    key={entry.userId}
                    className="hover:bg-gray-50/70 transition-colors group"
                  >
                    {/* Rank */}
                    <td className="px-6 py-4">
                      {isTop3 ? (
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white ${
                            rank === 1
                              ? "bg-amber-400"
                              : rank === 2
                                ? "bg-blue-500"
                                : "bg-orange-500"
                          }`}
                        >
                          #{rank}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400 pl-2">
                          #{rank}
                        </span>
                      )}
                    </td>

                    {/* Student */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                            isTop3
                              ? rank === 1
                                ? "bg-amber-100 text-amber-700"
                                : rank === 2
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {entry.userName
                            ? entry.userName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            : "?"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                            {entry.userName || "Học viên"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {rank <= 3 ? "Thành viên tích cực" : rank <= 5 ? "Chăm chỉ mỗi ngày" : "Đang tiến bộ"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-6 py-4 text-right font-medium text-gray-700">
                      {formatDuration(entry.totalSeconds)}
                    </td>

                    {/* Diamonds */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-primary">
                        <MaterialIcon name="diamond" filled className="text-sm" />
                        <span className="font-bold">{entry.totalDiamonds.toLocaleString()}</span>
                      </div>
                    </td>

                    {/* Progress */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              rank === 1
                                ? "bg-amber-400"
                                : rank === 2
                                  ? "bg-blue-500"
                                  : rank === 3
                                    ? "bg-orange-500"
                                    : "bg-primary/40"
                            }`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-500">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="px-6 py-4 bg-gray-50/50 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Hiển thị {Math.min(entries.length, 20)} / {entries.length} học sinh
          </p>
          <div className="flex gap-2">
            <button
              disabled
              className="p-2 border border-gray-200 rounded-lg text-gray-300 cursor-not-allowed"
            >
              <MaterialIcon name="chevron_left" className="text-lg" />
            </button>
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
              <MaterialIcon name="chevron_right" className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      {/* ---- Insight Cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
            <MaterialIcon name="trending_up" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tăng trưởng tuần</p>
            <p className="font-bold text-lg text-gray-900">+12.5%</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
            <MaterialIcon name="timer" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Trung bình học</p>
            <p className="font-bold text-lg text-gray-900">
              {avgMinutes >= 60
                ? `${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}p`
                : `${avgMinutes} phút`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <MaterialIcon name="auto_awesome" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tổng Kim cương</p>
            <p className="font-bold text-lg text-gray-900">{totalDiamonds.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-xl flex items-center justify-center shrink-0">
            <MaterialIcon name="person_celebrate" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tỉ lệ tham gia</p>
            <p className="font-bold text-lg text-gray-900">100%</p>
          </div>
        </div>
      </div>

    </div>
  );
}
