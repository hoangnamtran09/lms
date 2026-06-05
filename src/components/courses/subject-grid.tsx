"use client";

import { useEffect, useState, useMemo } from "react";
import { BookOpen, Zap, Sparkles, Trophy, ChevronRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { SubjectCard, SubjectCardSkeleton } from "@/components/courses/subject-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  gradeLevel: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

const gradeOptions = [10, 11, 12];

interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
}

interface Achievement {
  id: string;
  achievementId: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export function SubjectGrid() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [grade, setGrade] = useState<string>("all");
  const [streak, setStreak] = useState(0);
  const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = grade !== "all" ? `?gradeLevel=${grade}` : "";
    api<Subject[]>(`/api/subjects${params}`)
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [grade]);

  useEffect(() => {
    api<StreakInfo>("/api/streaks")
      .then((s) => setStreak(s.currentStreak))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api<Achievement[]>("/api/achievements/my")
      .then((data) => setRecentAchievements((data || []).slice(0, 3)))
      .catch(() => setRecentAchievements([]));
  }, []);

  const greeting = useMemo(() => getGreeting(), []);

  return (
    <div className="space-y-10 pb-12">
      {/* Welcome Section */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-primary mb-1">
              Môn Học Của Em
            </h1>
            <p className="text-base text-gray-500">
              {greeting}, tiếp tục hành trình khám phá kiến thức nhé!
            </p>
          </div>
          {/* Grade filter + Streak */}
          <div className="flex items-center gap-3">
            <Select value={grade} onValueChange={(v) => setGrade(v || "all")}>
              <SelectTrigger className="w-[160px] rounded-xl bg-white">
                <SelectValue placeholder="Tất cả khối" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả khối</SelectItem>
                {gradeOptions.map((g) => (
                  <SelectItem key={g} value={String(g)}>Khối {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Learning streak badge */}
            {streak > 0 && (
              <div className="inline-flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-3 shadow-sm">
                <div className="flex size-9 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Zap className="size-5 fill-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                    Streak học tập
                  </p>
                  <p className="text-base font-bold text-blue-700">
                    {streak} Ngày Liên Tiếp
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Layout: Grid + Aside */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Subject Grid */}
        <div className="lg:col-span-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <SubjectCardSkeleton key={i} />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-gray-100">
              <BookOpen className="size-12 text-gray-300 mb-4" />
              <p className="text-gray-500">Chưa có môn học nào cho khối lớp này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subjects.map((s) => (
                <SubjectCard key={s.id} subject={s} />
              ))}

            </div>
          )}
        </div>

        {/* Right: Contextual Info */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Recent Achievements */}
          <section className="rounded-3xl bg-blue-50/60 border border-blue-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Sparkles className="size-4" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Thành tích gần đây</h2>
            </div>
            {recentAchievements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Trophy className="size-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  Hãy bắt đầu học để mở khóa thành tích đầu tiên nhé!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAchievements.map((a) => (
                  <div key={a.id} className="flex gap-3 items-start">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-lg">
                      {a.icon || "🏆"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700">
                        <span className="font-bold text-gray-900">{a.title}</span>
                        {a.description && (
                          <span className="text-gray-500"> — {a.description}</span>
                        )}
                      </p>
                      <span className="text-[11px] text-gray-400">
                        {formatRelativeTime(a.earnedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Resource Promo Card */}
          <a
            href="https://baocamau.vn/bi-quyet-on-thi-tot-nghiep-thpt-2026-tu-hoc-sinh-gioi-a129291.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block relative overflow-hidden rounded-3xl h-48 group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600" />
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 size-32 rounded-full bg-white/10" />
            <div className="absolute -bottom-4 -left-4 size-20 rounded-full bg-white/10" />
            <div className="absolute inset-0 flex flex-col justify-end p-6">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
                Tài liệu mới
              </p>
              <h3 className="text-white text-lg font-bold leading-tight">
                Bí quyết ôn thi THPT Quốc gia 2026
              </h3>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-white/80 group-hover:text-white transition-colors">
                Đọc ngay <ChevronRight className="size-4" />
              </span>
            </div>
          </a>
        </aside>
      </div>
    </div>
  );
}
