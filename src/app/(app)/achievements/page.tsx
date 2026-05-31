"use client";

import { useEffect, useState } from "react";
import { Award, Sparkles, ArrowLeft, Gem, Star, Flame, Trophy, Target, Zap, BookOpen, Crown, Medal } from "lucide-react";
import { api } from "@/lib/api-client";
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

import type { FC } from "react";
import type { LucideProps } from "lucide-react";

const ICON_MAP: Record<string, FC<LucideProps>> = {
  Trophy: Trophy as FC<LucideProps>,
  Star: Star as FC<LucideProps>,
  Medal: Medal as FC<LucideProps>,
  Flame: Flame as FC<LucideProps>,
  Gem: Gem as FC<LucideProps>,
  Crown: Crown as FC<LucideProps>,
  Rocket: Zap as FC<LucideProps>,
  Fire: Flame as FC<LucideProps>,
  Ribbon: Medal as FC<LucideProps>,
  Lightning: Zap as FC<LucideProps>,
  Target: Target as FC<LucideProps>,
  BookOpen: BookOpen as FC<LucideProps>,
  Zap: Zap as FC<LucideProps>,
  Award: Award as FC<LucideProps>,
};

const RULE_TYPE_LABELS: Record<string, string> = {
  study_streak: "Duy trì học tập",
  lessons_completed: "Hoàn thành bài học",
  quizzes_passed: "Vượt qua bài kiểm tra",
  assignments_done: "Hoàn thành bài tập",
  diamonds_earned: "Tích luỹ kim cương",
};

// Icon background color by rule type
function getIconStyle(ruleType: string, earned: boolean): string {
  if (earned) {
    if (ruleType === "diamonds_earned") return "bg-blue-100 text-blue-500";
    return "bg-orange-100 text-orange-500";
  }
  if (ruleType === "diamonds_earned") return "bg-blue-50 text-blue-300";
  return "bg-orange-50 text-orange-300";
}

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
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <Skeleton delay={0} className="h-5 w-24 mb-6" />
        <Skeleton delay={60} className="h-10 w-72 mb-2" />
        <Skeleton delay={80} className="h-6 w-56 mb-10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} delay={100 + i * 80} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const earnedCount = earnedIds.size;

  return (
    <div className="animate-fade-in max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-medium mb-6 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <Award className="size-6" />
          </div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">
            Thành tựu
          </h1>
        </div>
        <p className="text-lg text-gray-500">
          Bạn đã đạt được{" "}
          <span className="font-bold text-primary">{earnedCount}</span> / {allAchievements.length} thành tựu
        </p>
      </div>

      {/* Achievement Grid */}
      {allAchievements.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center">
          <Award className="size-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Chưa có thành tựu nào</h3>
          <p className="text-sm text-gray-500">Hãy bắt đầu học để nhận thành tựu đầu tiên!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allAchievements.map((a) => {
            const earned = earnedIds.has(a.id);
            const ua = earnedMap.get(a.id);
            const IconComponent = ICON_MAP[a.icon];
            const iconBg = getIconStyle(a.ruleType, earned);

            return (
              <div
                key={a.id}
                className={`achievement-card bg-white p-6 sm:p-8 rounded-2xl border shadow-sm flex flex-col h-full transition-all hover:-translate-y-1 hover:shadow-md ${
                  earned ? "border-amber-200" : "border-gray-100"
                }`}
              >
                {/* Icon + Info */}
                <div className="flex items-start gap-5 mb-5">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${iconBg}`}
                  >
                    {IconComponent ? <IconComponent className="size-8" /> : <Award className="size-8" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-lg font-bold mb-1 ${earned ? "text-gray-900" : "text-gray-600"}`}>
                      {a.title}
                    </h3>
                    <p className={`text-sm leading-relaxed ${earned ? "text-gray-500" : "text-gray-400"}`}>
                      {a.description}
                    </p>
                    {!earned && (
                      <p className="text-[12px] text-gray-400 mt-1">
                        {RULE_TYPE_LABELS[a.ruleType] || a.ruleType}: {a.threshold}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: Status + Reward */}
                <div className="mt-auto flex justify-between items-center pt-2">
                  {earned ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs px-3 py-1 rounded-full">
                      <Sparkles className="size-3 mr-1" />
                      Đã đạt được
                    </Badge>
                  ) : (
                    <span className="px-4 py-1 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold">
                      Chưa đạt
                    </span>
                  )}
                  {a.diamondReward > 0 && (
                    <div className={`flex items-center gap-1.5 text-sm font-bold ${earned ? "text-amber-600" : "text-gray-400"}`}>
                      <Gem className="size-4" />
                      +{a.diamondReward}
                    </div>
                  )}
                </div>

                {/* Earned date */}
                {earned && ua && (
                  <p className="text-xs text-amber-500 mt-3">
                    Đạt được: {new Date(ua.earnedAt).toLocaleDateString("vi-VN")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
