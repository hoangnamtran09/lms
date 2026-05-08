"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { api } from "@/lib/api-client";

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

export function StreakBadge() {
  const [streak, setStreak] = useState<StreakInfo | null>(null);

  useEffect(() => {
    api<StreakInfo>("/api/streaks")
      .then(setStreak)
      .catch(() => {});
  }, []);

  if (!streak || streak.currentStreak === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
      <Flame className="size-3.5" />
      <span>{streak.currentStreak}</span>
    </div>
  );
}
