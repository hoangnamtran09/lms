"use client";

import { useEffect, useState, useCallback } from "react";
import { Calendar, Clock, BookOpen, Edit3, HelpCircle, FileText, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface PlanTask {
  id: string;
  title: string;
  description: string;
  type: "review" | "practice" | "quiz" | "assignment";
  estimatedMinutes: number;
  lessonId?: string;
  subjectName: string;
  priority: number;
  completed: boolean;
}

interface PlanData {
  id: string;
  date: string;
  tasks: PlanTask[];
  totalTasks: number;
  completedTasks: number;
}

const taskTypeMeta: Record<string, { icon: typeof BookOpen; label: string; color: string }> = {
  review: { icon: BookOpen, label: "Ôn tập", color: "text-blue-600 bg-blue-50" },
  practice: { icon: Edit3, label: "Luyện tập", color: "text-orange-600 bg-orange-50" },
  quiz: { icon: HelpCircle, label: "Kiểm tra", color: "text-purple-600 bg-purple-50" },
  assignment: { icon: FileText, label: "Bài tập", color: "text-red-600 bg-red-50" },
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(+y, +m - 1, +d);
  return date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(+y, +m - 1, +d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function StudyPlannerPage() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ plan: PlanData | null; date: string }>(`/api/study-planner/today?date=${d}`);
      setPlan(data.plan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchPlan(date); }, [date, fetchPlan]);

  const generatePlan = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await api<{ plan: PlanData }>("/api/study-planner/generate", {
        method: "POST",
      });
      setPlan(data.plan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setGenerating(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!plan) return;
    const task = plan.tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      const newCompleted = !task.completed;
      // Optimistic update
      setPlan({
        ...plan,
        tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t)),
        completedTasks: plan.completedTasks + (newCompleted ? 1 : -1),
      });

      await api(`/api/study-planner/${plan.id}/task/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: newCompleted }),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
      // Revert on error
      fetchPlan(date);
    }
  };

  const today = todayStr();
  const isToday = date === today;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-96" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kế hoạch học tập</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI phân tích dữ liệu của bạn để tạo kế hoạch học tập cá nhân hóa mỗi ngày
          </p>
        </div>

        {isToday && (
          <Button onClick={generatePlan} disabled={generating}>
            {generating ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            {generating ? "Đang tạo..." : plan ? "Tạo lại kế hoạch" : "Tạo kế hoạch hôm nay"}
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600 flex items-center gap-2">
          <span>{error}</span>
          <button
            onClick={() => fetchPlan(date)}
            className="underline shrink-0 ml-auto"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Date navigation */}
      <div className="flex items-center gap-3 mb-6 bg-white rounded-lg border px-4 py-2.5">
        <button
          onClick={() => setDate(shiftDate(date, -1))}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex-1 text-center">
          <span className="font-medium text-gray-900">{formatDate(date)}</span>
          {isToday && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Hôm nay
            </span>
          )}
        </div>

        <button
          onClick={() => setDate(shiftDate(date, 1))}
          className="p-1 hover:bg-gray-100 rounded"
          disabled={isToday}
        >
          <ChevronRight className={`size-4 ${isToday ? "text-gray-300" : ""}`} />
        </button>

        <button
          onClick={() => setDate(today)}
          className="ml-2 text-xs text-primary hover:underline"
        >
          <RefreshCw className="size-3 inline mr-1" />
          Về hôm nay
        </button>
      </div>

      {/* Empty state */}
      {!plan && !loading && (
        <div className="text-center py-20 bg-white rounded-lg border">
          <Calendar className="size-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {isToday ? "Chưa có kế hoạch cho hôm nay" : "Không có kế hoạch cho ngày này"}
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {isToday
              ? "Hãy để AI tạo kế hoạch học tập dựa trên điểm yếu và bài tập của bạn"
              : "Không có dữ liệu kế hoạch cho ngày đã chọn"}
          </p>
          {isToday && (
            <Button onClick={generatePlan} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              Tạo kế hoạch với AI
            </Button>
          )}
        </div>
      )}

      {/* Plan content */}
      {plan && (
        <>
          {/* Progress bar */}
          <div className="mb-6 bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Tiến độ hôm nay
              </span>
              <span className="text-sm text-gray-500">
                {plan.completedTasks}/{plan.totalTasks} nhiệm vụ
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{
                  width: plan.totalTasks > 0
                    ? `${(plan.completedTasks / plan.totalTasks) * 100}%`
                    : "0%",
                }}
              />
            </div>
            {plan.completedTasks === plan.totalTasks && plan.totalTasks > 0 && (
              <p className="text-sm text-green-600 mt-2 font-medium">
                Bạn đã hoàn thành tất cả nhiệm vụ hôm nay!
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {plan.tasks.map((task, i) => {
                const meta = taskTypeMeta[task.type] || taskTypeMeta.review;
                const Icon = meta.icon;
                const isCompleted = task.completed;

                return (
                  <div key={task.id} className="relative flex gap-4">
                    {/* Step circle */}
                    <button
                      onClick={() => toggleTask(task.id)}
                      className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isCompleted
                          ? "bg-primary border-primary text-white"
                          : "bg-white border-gray-300 text-gray-400 hover:border-primary"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <span className="text-xs font-bold">{i + 1}</span>
                      )}
                    </button>

                    {/* Task card */}
                    <div
                      className={`flex-1 bg-white rounded-lg border p-4 transition-opacity ${
                        isCompleted ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                              <Icon className="size-3" />
                              {meta.label}
                            </span>
                            <h3
                              className={`font-semibold text-gray-900 ${
                                isCompleted ? "line-through" : ""
                              }`}
                            >
                              {task.title}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600">{task.description}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                          <Clock className="size-3" />
                          {task.estimatedMinutes} phút
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span>{task.subjectName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
