"use client";

import { useEffect, useState } from "react";
import { Award, Sparkles, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface AchievementInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  ruleType: string;
  threshold: number;
  diamondReward: number;
  isActive: boolean;
}

interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

const ICON_MAP: Record<string, string> = {
  Trophy: "🏆",
  Star: "⭐",
  Medal: "🏅",
  Flame: "🔥",
  Gem: "💎",
  Crown: "👑",
  Rocket: "🚀",
  Fire: "✨",
  Ribbon: "🎀",
  Lightning: "⚡",
  Target: "🎯",
  BookOpen: "📖",
  Zap: "💥",
  Award: "🎖️",
};

const RULE_TYPE_LABELS: Record<string, string> = {
  study_streak: "Duy trì học tập",
  lessons_completed: "Hoàn thành bài học",
  quizzes_passed: "Vượt qua bài kiểm tra",
  assignments_done: "Hoàn thành bài tập",
  diamonds_earned: "Tích luỹ kim cương",
};

export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<AchievementInfo[]>([]);
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [earnedMap, setEarnedMap] = useState<Map<string, UserAchievement>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<AchievementInfo[]>("/api/achievements").catch(() => []),
      api<UserAchievement[]>("/api/achievements/my").catch(() => []),
    ]).then(([all, earned]) => {
      const activeAchievements = all.filter((a) => a.isActive);
      setAllAchievements(activeAchievements);
      const ids = new Set<string>();
      const map = new Map<string, UserAchievement>();
      earned.forEach((e) => {
        ids.add(e.achievementId);
        map.set(e.achievementId, e);
      });
      setEarnedIds(ids);
      setEarnedMap(map);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton delay={0} className="h-10 w-64" />
        <Skeleton delay={80} className="h-6 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} delay={100 + i * 80} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const earnedCount = earnedIds.size;

  return (
    <div className="animate-fade-in max-w-5xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200">
            <Award className="size-5 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Thành tựu
          </h1>
        </div>
        <p className="text-base text-gray-500">
          Bạn đã đạt được <span className="font-bold text-amber-600">{earnedCount}</span> / {allAchievements.length} thành tựu
        </p>
      </div>

      {allAchievements.length === 0 ? (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-12 text-center">
          <Award className="size-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Chưa có thành tựu nào</h3>
          <p className="text-sm text-gray-500">Hãy bắt đầu học để nhận thành tựu đầu tiên!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allAchievements.map((a) => {
            const earned = earnedIds.has(a.id);
            const ua = earnedMap.get(a.id);
            const emoji = ICON_MAP[a.icon] || "🏆";

            return (
              <Card
                key={a.id}
                className={`rounded-2xl border-0 ring-1 shadow-sm p-5 transition-all ${
                  earned
                    ? "ring-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50"
                    : "ring-gray-200/60 bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex items-center justify-center size-14 rounded-xl text-2xl flex-shrink-0 ${
                      earned
                        ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-200"
                        : "bg-gray-100"
                    }`}
                  >
                    {earned ? emoji : <span className="text-gray-300">{emoji}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-bold text-base ${earned ? "text-gray-900" : "text-gray-500"}`}>
                      {a.title}
                    </h3>
                    <p className={`text-sm mt-0.5 ${earned ? "text-gray-500" : "text-gray-400"}`}>
                      {a.description}
                    </p>
                    {!earned && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        {RULE_TYPE_LABELS[a.ruleType] || a.ruleType}: {a.threshold}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {earned ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-3 py-1">
                      <Sparkles className="size-3.5 mr-1" />
                      Đã đạt được
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400 text-xs px-3 py-1">
                      Chưa đạt
                    </Badge>
                  )}
                  {a.diamondReward > 0 && (
                    <span className={`text-xs font-medium ${earned ? "text-amber-600" : "text-gray-400"}`}>
                      💎 +{a.diamondReward}
                    </span>
                  )}
                </div>
                {earned && ua && (
                  <p className="text-xs text-amber-500 mt-2">
                    Đạt được: {new Date(ua.earnedAt).toLocaleDateString("vi-VN")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
