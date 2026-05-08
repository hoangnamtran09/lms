"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Clock, Flame, ChevronRight, Users } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildInfo {
  id: string;
  fullName: string;
  classId: string;
  todaySeconds: number;
  weekSeconds: number;
  pendingTasks: number;
  currentStreak: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ChildInfo[]>("/api/parents/children")
      .then(setChildren)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bảng điều khiển Phụ huynh</h1>
      <p className="text-sm text-gray-500 mb-6">Theo dõi tiến độ học tập của con</p>

      {children.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <Users className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có con nào được liên kết</p>
          <p className="text-sm text-gray-400 mt-1">
            Liên hệ giáo viên để liên kết tài khoản của con với tài khoản phụ huynh
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/parent/child/${child.id}`}
              className="block bg-white rounded-lg border p-5 hover:border-gray-300 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="size-5 text-red-400" />
                    <h2 className="text-lg font-bold text-gray-900">{child.fullName}</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Học hôm nay</p>
                      <p className="text-sm font-semibold">{formatDuration(child.todaySeconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Học tuần này</p>
                      <p className="text-sm font-semibold">{formatDuration(child.weekSeconds)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Bài tập</p>
                      <Badge variant={child.pendingTasks > 0 ? "default" : "outline"} className="text-xs">
                        {child.pendingTasks > 0 ? `${child.pendingTasks} cần làm` : "Hoàn thành"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Streak</p>
                      <p className="text-sm font-semibold flex items-center gap-1">
                        <Flame className="size-3 text-amber-500" />
                        {child.currentStreak} ngày
                      </p>
                    </div>
                  </div>
                </div>
                <ChevronRight className="size-5 text-gray-300 shrink-0 mt-2" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
