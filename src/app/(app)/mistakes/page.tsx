"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Sparkles, TrendingUp, RefreshCw, BookOpen, CheckCircle, HelpCircle, FileText, UserCheck, Clock } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RemediationExercise } from "@/components/ai/remediation-exercise";
import type { RemediationQuestion } from "@/components/ai/remediation-exercise";
import { MathText } from "@/components/ai/math-text";

interface RemediationResult {
  exercises: RemediationQuestion[];
  weaknessId: string;
  topic: string;
  subjectId: string;
  gradeLevel: number;
}

interface WeaknessProfile {
  id: string;
  userId: string;
  lessonId: string;
  topic: string;
  source: string;
  weight: number;
  errorCount: number;
  quizAttempts: number;
  quizCorrect: number;
  lastErrorAt: string | null;
  remediationExercises: string;
  improvementScore: number;
  resolved: boolean;
  resolvedAt: string | null;
  coachNotes: string;
}

interface LessonInfo {
  id: string;
  title: string;
}

const sourceConfig: Record<string, { icon: typeof HelpCircle; label: string; color: string }> = {
  quiz: { icon: HelpCircle, label: "Quiz", color: "bg-blue-50 text-blue-700 border-blue-200" },
  exercise: { icon: FileText, label: "Bài tập", color: "bg-purple-50 text-purple-700 border-purple-200" },
  profile: { icon: UserCheck, label: "GV thiết lập", color: "bg-red-50 text-red-700 border-red-200" },
  progress: { icon: Clock, label: "Kẹt bài", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

export default function MistakesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null); // lessonId of the group being generated
  const [exercises, setExercises] = useState<Record<string, RemediationQuestion[]>>({});
  const [lessonMap, setLessonMap] = useState<Record<string, string>>({});

  useEffect(() => {
    api<WeaknessProfile[]>("/api/weaknesses")
      .then(async (data) => {
        setProfiles(data);
        // Parse existing remediation exercises
        const ex: Record<string, RemediationQuestion[]> = {};
        for (const p of data) {
          if (p.remediationExercises) {
            try {
              ex[p.id] = JSON.parse(p.remediationExercises);
            } catch {}
          }
        }
        setExercises(ex);

        // Fetch lesson titles for unique lessonIds
        const uniqueLessonIds = [...new Set(data.map((p) => p.lessonId).filter(Boolean))];
        const map: Record<string, string> = {};
        await Promise.all(
          uniqueLessonIds.map((lid) =>
            api<LessonInfo>(`/api/lessons/${lid}`)
              .then((l) => { map[lid] = l.title; })
              .catch(() => { map[lid] = lid; })
          )
        );
        setLessonMap(map);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleResolve = async (id: string) => {
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, resolved: true, resolvedAt: new Date().toISOString() } : p))
    );
    try {
      await api(`/api/weaknesses/${id}/resolve`, { method: "POST" });
    } catch {
      setProfiles((prev) =>
        prev.map((p) => (p.id === id ? { ...p, resolved: false, resolvedAt: null } : p))
      );
    }
  };

  const handleImprove = async (weaknessId: string) => {
    try {
      const p = await api<WeaknessProfile>(`/api/weaknesses/${weaknessId}/improve`, { method: "POST" });
      setProfiles((prev) =>
        prev.map((w) => (w.id === weaknessId ? { ...w, improvementScore: p.improvementScore, resolved: p.resolved } : w))
      );
    } catch {}
  };

  // Generate remediation for all active weaknesses in a lesson group
  const generateForLesson = async (lessonId: string, items: WeaknessProfile[]) => {
    const activeItems = items.filter((p) => !p.resolved);
    if (activeItems.length === 0) return;
    setGeneratingId(lessonId);
    try {
      const results = await Promise.all(
        activeItems.map((p) =>
          api<RemediationResult>("/api/ai/remediation", {
            method: "POST",
            body: JSON.stringify({ weaknessId: p.id }),
          }).then((result) => {
            setExercises((prev) => ({ ...prev, [p.id]: result.exercises }));
            return result;
          })
        )
      );

      // Create a single assignment from all generated exercises
      if (results.length > 0 && user) {
        const allExercises = results.flatMap((r) => r.exercises);
        const topics = results.map((r) => r.topic).filter(Boolean);
        const firstResult = results[0];
        const lessonTitle = lessonMap[lessonId] || "bài học";

        await api("/api/assignments", {
          method: "POST",
          body: JSON.stringify({
            title: `Bài tập cải thiện: ${topics.join(", ")}`,
            description: JSON.stringify(allExercises),
            source: "weakness",
            studentIds: JSON.stringify([user.id]),
            subjectId: firstResult.subjectId,
            gradeLevel: firstResult.gradeLevel,
            maxScore: allExercises.length * 10,
          }),
        });

        router.push("/assignments");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi tạo bài tập");
    } finally {
      setGeneratingId(null);
    }
  };

  // Group by lesson
  const grouped = new Map<string, WeaknessProfile[]>();
  for (const p of profiles) {
    const key = p.lessonId || "__unknown__";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(p);
  }

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
        <p className="text-sm text-gray-500 mt-1">Những chủ đề bạn cần ôn luyện thêm, gom theo bài học</p>
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
        <div className="space-y-6">
          {[...grouped.entries()].map(([lessonId, items]) => (
            <div key={lessonId} className="bg-white rounded-lg border">
              {/* Lesson header */}
              <div className="px-5 py-3 bg-gray-50 border-b flex items-center gap-2">
                <BookOpen className="size-4 text-gray-500" />
                <h2 className="font-semibold text-gray-800">
                  {lessonMap[lessonId] || lessonId}
                </h2>
                <Badge variant="outline" className="text-xs">
                  {items.length} điểm yếu
                </Badge>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateForLesson(lessonId, items)}
                  disabled={generatingId === lessonId}
                >
                  {generatingId === lessonId ? (
                    <RefreshCw className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 mr-1" />
                  )}
                  {generatingId === lessonId ? "Đang tạo..." : "Tạo bài tập cải thiện"}
                </Button>
              </div>

              {/* Weakness items */}
              <div className="divide-y">
                {items.map((p) => (
                  <div key={p.id} className={`p-5 ${p.resolved ? "bg-green-50/50" : ""}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {p.resolved ? (
                            <CheckCircle className="size-4 text-green-600" />
                          ) : (
                            <AlertCircle className="size-4 text-amber-500" />
                          )}
                          <h3 className={`font-semibold ${p.resolved ? "text-gray-500 line-through" : "text-gray-900"}`}><MathText text={p.topic} /></h3>
                          <Badge variant="destructive" className="text-xs">
                            {p.errorCount} lần
                          </Badge>
                          {p.source && sourceConfig[p.source] && (
                            <Badge variant="outline" className={`text-xs ${sourceConfig[p.source].color}`}>
                              {(() => { const Icon = sourceConfig[p.source].icon; return <Icon className="size-3 mr-0.5" />; })()}
                              {sourceConfig[p.source].label}
                            </Badge>
                          )}
                          {p.weight > 0 && (
                            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                              {p.weight.toFixed(1)} điểm
                            </Badge>
                          )}
                          {p.improvementScore > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <TrendingUp className="size-3 mr-1" />
                              {p.improvementScore} lần cải thiện
                            </Badge>
                          )}
                          {p.resolved ? (
                            <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                              <CheckCircle className="size-3 mr-1" />Đã hoàn thành
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                              Cần cải thiện
                            </Badge>
                          )}
                        </div>
                        {p.lastErrorAt && (
                          <p className="text-xs text-gray-400">
                            Lỗi gần nhất: {new Date(p.lastErrorAt).toLocaleString("vi-VN")}
                          </p>
                        )}
                      </div>
                      {!p.resolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolve(p.id)}
                          className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="size-3.5 mr-1" />
                          Đánh dấu đã hiểu
                        </Button>
                      )}
                    </div>

                    {p.coachNotes && (
                      <div className="mb-3 p-2 bg-blue-50 rounded text-sm text-blue-700">
                        <span className="font-medium">Ghi chú của giáo viên:</span> <MathText text={p.coachNotes} />
                      </div>
                    )}

                    {exercises[p.id] && exercises[p.id].length > 0 && (
                      <div className="border-t pt-3 space-y-3">
                        <p className="text-sm font-medium text-gray-700">Bài tập cải thiện:</p>
                        {exercises[p.id].map((ex, i) => (
                          <RemediationExercise
                            key={i}
                            exercise={ex}
                            lessonId={p.lessonId}
                            onCorrect={() => handleImprove(p.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
