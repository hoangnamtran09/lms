"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildDetail {
  id: string;
  fullName: string;
  totalSeconds: number;
  weaknesses: { topic: string; errorCount: number }[];
  submissions: { id: string; title: string; score: number | null; status: string; submittedAt: string }[];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} phút`;
}

const statusLabel: Record<string, string> = {
  SUBMITTED: "Chờ chấm",
  GRADED: "Đã chấm",
  RETURNED: "Đã trả",
};

const backLink = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4";

export default function ChildDetailPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = use(params);
  const [detail, setDetail] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ChildDetail>(`/api/parents/children/${childId}`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [childId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-20 w-full rounded-lg" />
        <Skeleton delay={200} className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Không tìm thấy thông tin</p>
        <Link href="/parent" className={backLink + " justify-center"}>
          <ArrowLeft className="size-4" />
          Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/parent" className={backLink}>
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{detail.fullName}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tổng thời gian học: {formatDuration(detail.totalSeconds)}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weaknesses */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-500" />
              Điểm yếu
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.weaknesses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Không có điểm yếu nào</p>
            ) : (
              <div className="space-y-2">
                {detail.weaknesses.map((w, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-gray-900">{w.topic}</span>
                    <Badge variant="destructive" className="text-xs">{w.errorCount} lần</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent submissions */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="size-4 text-blue-500" />
              Bài nộp gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detail.submissions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Chưa có bài nộp nào</p>
            ) : (
              <div className="space-y-2">
                {detail.submissions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-gray-900 truncate max-w-[200px]">{sub.title}</span>
                    <div className="flex items-center gap-2">
                      {sub.score != null && (
                        <Badge variant="default" className="text-xs">{sub.score}</Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {statusLabel[sub.status] || sub.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
