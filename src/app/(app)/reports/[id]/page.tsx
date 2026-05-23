"use client";

import { useEffect, useState, use } from "react";
import {
  ArrowLeft, Clock, Award, Gem, Flame,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
  title: string;
  overallAssessment: string;
  highlights: string[];
  weaknessAnalysis: string;
  trendComparison: string;
  recommendations: string[];
  coachMessage: string;
}

interface ReportResponse {
  id: string;
  weekStart: string;
  weekEnd: string;
  report: ReportData | null;
  aiMessage: AIMessage | string | null;
  createdAt: string;
}

function parseAIMessage(msg: AIMessage | string | null): AIMessage | null {
  if (!msg) return null;
  if (typeof msg === "string") {
    try {
      return JSON.parse(msg);
    } catch {
      return { title: "", overallAssessment: "neutral", highlights: [], weaknessAnalysis: "", trendComparison: "", recommendations: [], coachMessage: msg } as AIMessage;
    }
  }
  return msg;
}

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    const date = new Date(+y, +m - 1, +day);
    return date.toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
  };
  return `${fmt(start)} — ${fmt(end)}`;
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h${min > 0 ? min : ""}`;
  return `${min}ph`;
}

function dayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(+y, +m - 1, +d);
  return date.toLocaleDateString("vi-VN", { weekday: "short" });
}

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      const data = await api<ReportResponse>(`/api/reports/${id}`);
      setReport(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => { fetchReport(); }, [id]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const ai = report ? parseAIMessage(report.aiMessage) : null;
  const data = report?.report;

  const trendIcon = (current: number, prev: number) => {
    if (current > prev) return <TrendingUp className="size-3 text-green-500" />;
    if (current < prev) return <TrendingDown className="size-3 text-red-500" />;
    return <Minus className="size-3 text-gray-400" />;
  };

  const trendColor = (current: number, prev: number) =>
    current > prev ? "text-green-600" : current < prev ? "text-red-600" : "text-gray-500";

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">{error}</p>
        <Button onClick={fetchReport}>Thử lại</Button>
      </div>
    );
  }

  if (!report) return null;

  const weekNum = report.weekStart
    ? Math.ceil((new Date(report.weekStart).getTime() - new Date(+report.weekStart.slice(0, 4), 0, 1).getTime()) / 604800000)
    : "—";

  return (
    <div>
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="size-4" />
        Quay lại danh sách
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {ai?.title || `Báo cáo tuần ${weekNum}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{formatDateRange(report.weekStart, report.weekEnd)}</p>
      </div>

      {ai?.overallAssessment && (
        <div className={`mb-5 px-4 py-2 rounded-lg text-sm font-medium inline-block ${
          ai.overallAssessment === "positive"
            ? "bg-green-50 text-green-700"
            : ai.overallAssessment === "needsImprovement"
            ? "bg-red-50 text-red-700"
            : "bg-yellow-50 text-yellow-700"
        }`}>
          {ai.overallAssessment === "positive" ? "📈 Tuần tích cực"
            : ai.overallAssessment === "needsImprovement" ? "📉 Cần cố gắng hơn"
            : "📊 Tuần ổn định"}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="size-4 text-blue-600" />
                <span className="text-xs text-blue-600 font-medium">Thời gian học</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{formatMinutes(data.totalStudyMinutes)}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${trendColor(data.totalStudyMinutes, data.previousWeekMinutes)}`}>
                {trendIcon(data.totalStudyMinutes, data.previousWeekMinutes)}
                {data.previousWeekMinutes > 0
                  ? `${Math.round((data.totalStudyMinutes - data.previousWeekMinutes) / data.previousWeekMinutes * 100)}%`
                  : "Tuần đầu"}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Award className="size-4 text-green-600" />
                <span className="text-xs text-green-600 font-medium">Bài hoàn thành</span>
              </div>
              <p className="text-2xl font-bold text-green-900">{data.completedAssignments}</p>
              <p className="text-xs text-green-600 mt-1">Điểm TB: {data.avgScore.toFixed(1)}</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gem className="size-4 text-amber-600" />
                <span className="text-xs text-amber-600 font-medium">Kim cương</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">+{data.diamondsEarned}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${trendColor(data.diamondsEarned, data.diamondsEarned || 0)}`}>
                {trendIcon(data.diamondsEarned, data.diamondsEarned || 0)}
                Tuần này
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="size-4 text-orange-600" />
                <span className="text-xs text-orange-600 font-medium">Streak</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">{data.currentStreak} ngày</p>
              <p className="text-xs text-orange-600 mt-1">
                {data.currentStreak >= 7 ? "🔥 Đang cháy!" : data.currentStreak >= 3 ? "👍 Khá tốt" : "💪 Cố gắng"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="lg:col-span-2 bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">📊 Thời gian học theo ngày</h3>
              {data.dailyStudy.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyStudy.map(d => ({ ...d, label: dayLabel(d.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} unit="ph" />
                    <Tooltip
                      formatter={(value) => [`${value ?? 0} phút`, "Học tập"]}
                      labelFormatter={(label) => `Ngày ${label}`}
                    />
                    <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                  Chưa có dữ liệu học tập trong tuần này
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">🔴 Điểm yếu cần cải thiện</h3>
              {data.topWeaknesses.length > 0 ? (
                <div className="space-y-4">
                  {data.topWeaknesses.slice(0, 3).map((w, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-700 truncate">{w.topic}</span>
                        <span className={`text-xs flex items-center gap-0.5 ${
                          w.trend === "improving" ? "text-green-600"
                            : w.trend === "needsAttention" ? "text-red-600"
                            : "text-yellow-600"
                        }`}>
                          {w.trend === "improving" ? <TrendingUp className="size-3" />
                            : w.trend === "needsAttention" ? <TrendingDown className="size-3" />
                            : <Minus className="size-3" />}
                          {w.errorCount} lỗi
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          w.trend === "improving" ? "bg-green-500"
                            : w.trend === "needsAttention" ? "bg-red-500"
                            : "bg-yellow-500"
                        }`} style={{ width: `${Math.min(100, w.errorCount * 20)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
                  Không có điểm yếu nào
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {ai?.highlights && ai.highlights.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-indigo-800 mb-3">✨ Điểm nổi bật</h3>
          <ul className="space-y-2">
            {ai.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-900">
                <span className="text-indigo-400 mt-0.5">•</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai?.trendComparison && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">📈 So sánh với tuần trước</h3>
          <p className="text-sm text-gray-600">{ai.trendComparison}</p>
        </div>
      )}

      {ai?.weaknessAnalysis && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">🔍 Phân tích điểm yếu</h3>
          <p className="text-sm text-gray-600">{ai.weaknessAnalysis}</p>
        </div>
      )}

      {ai?.recommendations && ai.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-emerald-800 mb-3">📋 Đề xuất cho tuần tới</h3>
          <ul className="space-y-2">
            {ai.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-900">
                <span className="text-emerald-500 font-bold mt-0.5">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ai?.coachMessage && (
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <span className="font-semibold text-purple-800">AI Coach nhận xét</span>
          </div>
          <div className="text-sm text-purple-900 leading-relaxed whitespace-pre-line">
            {ai.coachMessage.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}
          </div>
        </div>
      )}
    </div>
  );
}
