"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Sparkles, TrendingUp, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WeaknessProfile {
  id: string;
  userId: string;
  lessonId: string;
  topic: string;
  errorCount: number;
  lastErrorAt: string | null;
  remediationExercises: string;
  improvementScore: number;
  coachNotes: string;
}

interface RemediationExercise {
  title: string;
  question: string;
  hint: string;
}

export default function MistakesPage() {
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Record<string, RemediationExercise[]>>({});

  useEffect(() => {
    api<WeaknessProfile[]>("/api/weaknesses")
      .then((data) => {
        setProfiles(data);
        // Parse existing remediation exercises
        const ex: Record<string, RemediationExercise[]> = {};
        for (const p of data) {
          if (p.remediationExercises) {
            try {
              ex[p.id] = JSON.parse(p.remediationExercises);
            } catch {}
          }
        }
        setExercises(ex);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const generateRemediation = async (profile: WeaknessProfile) => {
    setGeneratingId(profile.id);
    try {
      const result = await api<{ exercises: RemediationExercise[] }>("/api/ai/remediation", {
        method: "POST",
        body: JSON.stringify({ weaknessId: profile.id }),
      });
      setExercises((prev) => ({ ...prev, [profile.id]: result.exercises }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Điểm yếu & Cải thiện</h1>
        <p className="text-sm text-gray-500 mt-1">Những chủ đề bạn cần ôn luyện thêm</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {profiles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <TrendingUp className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Bạn chưa có điểm yếu nào được ghi nhận</p>
          <p className="text-sm text-gray-400 mt-1">Tiếp tục làm bài tập để hệ thống phân tích</p>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="size-4 text-amber-500" />
                    <h3 className="font-semibold text-gray-900">{p.topic}</h3>
                    <Badge variant="destructive" className="text-xs">
                      {p.errorCount} lần
                    </Badge>
                    {p.improvementScore > 0 && (
                      <Badge variant="outline" className="text-xs">
                        <TrendingUp className="size-3 mr-1" />
                        {p.improvementScore} lần cải thiện
                      </Badge>
                    )}
                  </div>
                  {p.lastErrorAt && (
                    <p className="text-xs text-gray-400">
                      Lỗi gần nhất: {new Date(p.lastErrorAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateRemediation(p)}
                  disabled={generatingId === p.id}
                >
                  {generatingId === p.id ? (
                    <RefreshCw className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 mr-1" />
                  )}
                  {generatingId === p.id ? "Đang tạo..." : "Tạo bài tập cải thiện"}
                </Button>
              </div>

              {p.coachNotes && (
                <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                  <span className="font-medium">Ghi chú của giáo viên:</span> {p.coachNotes}
                </div>
              )}

              {exercises[p.id] && exercises[p.id].length > 0 && (
                <div className="border-t pt-3 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Bài tập cải thiện:</p>
                  {exercises[p.id].map((ex, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium text-gray-900 text-sm">{i + 1}. {ex.title}</p>
                      <p className="text-sm text-gray-700 mt-1">{ex.question}</p>
                      <p className="text-xs text-amber-600 mt-1">Gợi ý: {ex.hint}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
