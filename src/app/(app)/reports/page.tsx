"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Loader2, Sparkles, ChevronRight, Clock, Award, Gem, Flame } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

interface ReportData {
  dailyStudy: { date: string; minutes: number }[];
  totalStudyMinutes: number;
  previousWeekMinutes: number;
  completedAssignments: number;
  avgScore: number;
  topWeaknesses: { topic: string; errorCount: number; trend: string }[];
  diamondsEarned: number;
  currentStreak: number;
}

interface AIMessage {
  title?: string;
  overallAssessment?: string;
  highlights?: string[];
  coachMessage?: string;
}

interface ReportItem {
  id: string;
  weekStart: string;
  weekEnd: string;
  report: ReportData | null;
  aiMessage: AIMessage | string | null;
  createdAt: string;
}

interface ListResponse {
  reports: ReportItem[];
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    const date = new Date(+y, +m - 1, +day);
    return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h${min > 0 ? min : ""}`;
  return `${min}ph`;
}

function weekNumber(weekStart: string): number {
  const [y, m, d] = weekStart.split("-");
  const date = new Date(+y, +m - 1, +d);
  const startOfYear = new Date(+y, 0, 1);
  const diff = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return Math.ceil((diff + startOfYear.getDay() + 1) / 7);
}

function parseAIMessage(msg: AIMessage | string | null): AIMessage | null {
  if (!msg) return null;
  if (typeof msg === "string") {
    try {
      return JSON.parse(msg);
    } catch {
      return { coachMessage: msg };
    }
  }
  return msg;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ListResponse>("/api/reports/list?limit=20");
      setReports(data.reports || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
  }, [fetchReports]);

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      await api("/api/reports/generate", { method: "POST" });
      await fetchReports();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo tuần</h1>
          <p className="text-sm text-gray-500 mt-1">
            Báo cáo tiến độ học tập cá nhân hóa mỗi tuần, do AI phân tích
          </p>
        </div>
        <Button onClick={generateReport} disabled={generating}>
          {generating ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="size-4 mr-2" />
          )}
          {generating ? "Đang tạo..." : "Tạo báo cáo tuần này"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span>{error}</span>
          <button onClick={fetchReports} className="underline shrink-0 ml-auto">
            Thử lại
          </button>
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="text-center py-20 bg-white rounded-lg border">
          <BarChart3 className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Chưa có báo cáo nào</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Tạo báo cáo tuần này để theo dõi tiến độ học tập và nhận nhận xét từ AI
          </p>
          <Button onClick={generateReport} disabled={generating}>
            {generating ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            Tạo báo cáo với AI
          </Button>
        </div>
      )}

      {reports.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((r) => {
            const ai = parseAIMessage(r.aiMessage);
            const stats = [
              { icon: Clock, label: "Học tập", value: r.report ? formatMinutes(r.report.totalStudyMinutes) : "—" },
              { icon: Award, label: "Bài làm", value: r.report ? `${r.report.completedAssignments} bài` : "—" },
              { icon: Gem, label: "Kim cương", value: r.report ? `+${r.report.diamondsEarned}` : "—" },
              { icon: Flame, label: "Streak", value: r.report ? `${r.report.currentStreak} ngày` : "—" },
            ];

            return (
              <Link
                key={r.id}
                href={`/reports/${r.id}`}
                className="block bg-white rounded-xl border hover:shadow-md transition-shadow p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Tuần {weekNumber(r.weekStart)}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateRange(r.weekStart, r.weekEnd)}</span>
                </div>

                {ai?.title && (
                  <p className="font-semibold text-gray-900 mb-3 line-clamp-1">{ai.title}</p>
                )}

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {stats.map((s) => (
                    <div key={s.label} className="text-center">
                      <s.icon className="size-4 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs font-semibold text-gray-800">{s.value}</p>
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {ai?.coachMessage && (
                  <p className="text-xs text-gray-500 line-clamp-2">{ai.coachMessage.replace(/\*\*/g, "")}</p>
                )}

                <div className="mt-3 flex items-center text-xs text-indigo-600 font-medium">
                  Xem chi tiết <ChevronRight className="size-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
