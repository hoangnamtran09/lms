"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, FileText, Clock, Award, Flame, Gem, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    const date = new Date(+y, +m - 1, +day);
    return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
  };
  return `${fmt(start)} - ${fmt(end)}`;
}

function formatMinutes(m: number) {
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  return mins > 0 ? `${h}h ${mins}p` : `${h} giờ`;
}

function parseAiMessage(msg: AIMessage | string | null): AIMessage {
  if (!msg) return {};
  if (typeof msg === "string") {
    try { return JSON.parse(msg); } catch { return {}; }
  }
  return msg;
}

export default function TeacherStudentReportsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<ReportItem[]>(`/api/reports/list?userId=${studentId}&limit=20`).catch(() => []),
      api<{ fullName: string }>(`/api/users/${studentId}`).catch(() => null),
    ])
      .then(([r, user]) => {
        setReports(Array.isArray(r) ? r : []);
        if (user) setStudentName(user.fullName);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={80} className="h-6 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} delay={80 + i * 100} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Không thể tải báo cáo</p>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
        <Link href="/teacher/reports" className="text-sm text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách học sinh
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      <Link
        href="/teacher/reports"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại danh sách
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Báo cáo tuần{studentName ? ` — ${studentName}` : ""}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{reports.length} báo cáo</p>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border">
          <FileText className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Học sinh này chưa có báo cáo tuần nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((item) => {
            const aiMsg = parseAiMessage(item.aiMessage);
            const r = item.report;
            return (
              <Card key={item.id} className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {aiMsg.title || `Tuần ${formatDateRange(item.weekStart, item.weekEnd)}`}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {formatDateRange(item.weekStart, item.weekEnd)}
                    </p>
                  </div>
                  {aiMsg.overallAssessment && (
                    <Badge
                      variant={
                        aiMsg.overallAssessment === "positive"
                          ? "default"
                          : aiMsg.overallAssessment === "neutral"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize"
                    >
                      {aiMsg.overallAssessment === "positive"
                        ? "Tích cực"
                        : aiMsg.overallAssessment === "neutral"
                        ? "Bình thường"
                        : "Cần cải thiện"}
                    </Badge>
                  )}
                </div>

                {r && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="size-4 text-blue-500" />
                      <span className="text-gray-600">{formatMinutes(r.totalStudyMinutes)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="size-4 text-amber-500" />
                      <span className="text-gray-600">{r.avgScore.toFixed(1)} điểm</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Gem className="size-4 text-violet-500" />
                      <span className="text-gray-600">{r.diamondsEarned} KC</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Flame className="size-4 text-orange-500" />
                      <span className="text-gray-600">{r.currentStreak} ngày</span>
                    </div>
                  </div>
                )}

                {aiMsg.coachMessage && (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 italic">
                    {aiMsg.coachMessage}
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
