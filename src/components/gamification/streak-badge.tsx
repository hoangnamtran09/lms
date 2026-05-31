"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { MaterialIcon } from "@/components/ui/material-icon";

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
    <div className="flex items-center gap-1 text-xs font-medium text-orange-600">
      <MaterialIcon name="local_fire_department" filled className="text-base" />
      <span>{streak.currentStreak}</span>
    </div>
  );
}
