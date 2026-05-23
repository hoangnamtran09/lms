"use client";

import { useEffect, useState } from "react";
import { Map, Clock, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface RoadmapStep {
  step: number;
  title: string;
  description: string;
  estimatedMinutes: number;
}

export default function RoadmapPage() {
  const [steps, setSteps] = useState<RoadmapStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateRoadmap = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await api<RoadmapStep[]>("/api/ai/roadmap", {
        method: "POST",
        body: JSON.stringify({ subjectId: "" }),
      });
      setSteps(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { generateRoadmap(); }, []);

  if (loading || generating) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <p className="text-sm text-gray-500">Đang phân tích điểm yếu và tạo lộ trình học...</p>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lộ trình học cá nhân</h1>
          <p className="text-sm text-gray-500 mt-1">
            Dựa trên điểm yếu của bạn, AI đề xuất lộ trình cải thiện
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={generateRoadmap} disabled={generating}>
          <Sparkles className="size-4 mr-2" />
          {generating ? "Đang tạo..." : "Tạo lại"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {steps.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg border">
          <Map className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có lộ trình học tập</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Hãy làm bài tập để hệ thống phân tích điểm yếu</p>
          <Button onClick={generateRoadmap} disabled={generating}>
            <Sparkles className="size-4 mr-2" />
            Tạo lộ trình với AI
          </Button>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="relative flex gap-4">
                <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                  {step.step || i + 1}
                </div>
                <div className="flex-1 bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{step.title}</h3>
                    <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 ml-2">
                      <Clock className="size-3" />
                      {step.estimatedMinutes || 30} phút
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
