"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { Loader2, ArrowLeft, Lightbulb, CheckCircle, Circle, CircleDot, Brain, Zap, History } from "lucide-react";

// ---------- Types ----------

interface WeaknessProfile {
  id: string;
  userId: string;
  lessonId: string;
  topic: string;
  source: string;
  weight: number;
  errorCount: number;
  improvementScore: number;
  resolved: boolean;
}

interface QuizQuestion {
  id?: string;
  question: string;
  weaknessTopic?: string;
  weaknessId?: string;
  options?: { text: string; isCorrect: boolean }[];
  explanation?: string;
}

// ---------- Inner component (uses useSearchParams) ----------

function PracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId") || "";
  const subjectName = searchParams.get("subjectName") || "Không rõ";
  const lessonTitle = searchParams.get("lessonTitle") || "Bài học";

  const [weaknesses, setWeaknesses] = useState<WeaknessProfile[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<"idle" | "checking" | "correct" | "incorrect">("idle");
  const [explanation, setExplanation] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!lessonId) return;
    api<WeaknessProfile[]>("/api/weaknesses")
      .then((data) => {
        const active = (data || []).filter((w) => !w.resolved && w.lessonId === lessonId);
        setWeaknesses(active);
        if (active.length === 0) {
          setLoading(false);
          return;
        }
        generateQuiz(active);
      })
      .catch((e) => {
        setError(e.message || "Không thể tải dữ liệu");
        setLoading(false);
      });
  }, [lessonId]);

  const generateQuiz = async (items: WeaknessProfile[]) => {
    try {
      const data = await api<{ questions: QuizQuestion[] }>("/api/ai/generate-weakness-quiz", {
        method: "POST",
        body: JSON.stringify({
          weaknesses: items.map((w) => ({ id: w.id, topic: w.topic })),
          subjectName,
          lessonTitle,
        }),
        timeout: 120000,
      });
      setQuestions(data.questions || []);
    } catch (e) {
      setError("Không thể tạo câu hỏi luyện tập");
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = useCallback(async () => {
    if (selectedOption === null || answerState !== "idle") return;
    setAnswerState("checking");

    const q = questions[currentIdx];
    if (!q) return;

    const correctIdx = q.options?.findIndex((o) => o.isCorrect) ?? -1;
    const isCorrect = selectedOption === correctIdx;

    if (isCorrect && q.weaknessId) {
      try {
        await api(`/api/weaknesses/${q.weaknessId}/resolve`, { method: "POST" });
        setResolvedIds((prev) => new Set(prev).add(q.weaknessId!));
      } catch { /* ignore */ }
    }

    setExplanation(q.explanation || "");
    setAnswerState(isCorrect ? "correct" : "incorrect");
  }, [selectedOption, answerState, questions, currentIdx]);

  const handleNext = () => {
    setSelectedOption(null);
    setAnswerState("idle");
    setExplanation("");
    setShowHint(false);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  };

  const currentQ = questions[currentIdx];
  const currentWeakness = weaknesses.find((w) => w.id === currentQ?.weaknessId);
  const correctIdx = currentQ?.options?.findIndex((o) => o.isCorrect) ?? -1;
  const totalQuestions = questions.length;
  const completedCount = resolvedIds.size;
  const progressPct = totalQuestions > 0 ? Math.round((completedCount / totalQuestions) * 100) : 0;
  const allDone = totalQuestions > 0 && completedCount >= totalQuestions;

  // Shared breadcrumb bar
  const BreadcrumbBar = (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <Link href="/mistakes" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
        <ArrowLeft className="size-5 text-blue-600" />
      </Link>
      <div className="h-6 w-[2px] bg-gray-300 shrink-0" />
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">
          {subjectName} — {lessonTitle}
        </h1>
        <p className="text-xs text-gray-500">Luyện tập khắc phục lỗ hổng kiến thức</p>
      </div>
    </div>
  );

  // ---- Loading ----
  if (loading) {
    return (
      <div>
        {BreadcrumbBar}
        <div className="flex gap-6">
          <div className="w-[240px] shrink-0 bg-white rounded-2xl border border-gray-200 p-5 space-y-3 hidden lg:block">
            {[1, 2, 3].map((i) => <Skeleton key={i} delay={i * 100} className="h-14 w-full rounded-xl" />)}
          </div>
          <div className="flex-1 flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="size-10 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">AI đang tạo bài tập khắc phục...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div>
        {BreadcrumbBar}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={() => router.back()} className="text-blue-600 font-medium hover:underline">Quay lại</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Empty ----
  if (weaknesses.length === 0) {
    return (
      <div>
        {BreadcrumbBar}
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="size-10 text-teal-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Không có điểm yếu nào</h3>
            <p className="text-gray-500 mb-4">Tất cả điểm yếu trong bài học này đã được khắc phục!</p>
            <Link href="/mistakes" className="text-blue-600 font-medium hover:underline">Quay lại danh sách</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- All Done ----
  if (allDone) {
    return (
      <div>
        {BreadcrumbBar}
        <div className="flex items-center justify-center py-20">
          <div className="text-center animate-fade-in">
            <div className="w-24 h-24 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="size-14 text-teal-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tuyệt vời!</h2>
            <p className="text-gray-500 mb-2">Em đã khắc phục tất cả {totalQuestions} điểm yếu trong bài học này</p>
            <p className="text-sm text-teal-600 font-medium mb-6">Tất cả điểm yếu đã được đánh dấu đã hiểu</p>
            <Link
              href="/mistakes"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
            >
              <ArrowLeft className="size-4" />
              Quay lại danh sách điểm yếu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main Practice UI ----
  return (
    <div>
      {BreadcrumbBar}

      <div className="flex gap-6">
        {/* ---- Left Sidebar: Weak Points ---- */}
        <aside className="w-[240px] shrink-0 hidden lg:flex flex-col sticky top-[72px] self-start max-h-[calc(100vh-88px)] bg-white rounded-2xl border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Điểm yếu cần khắc phục</h2>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">
              Hoàn thành {completedCount}/{totalQuestions} mục tiêu
            </span>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {questions.map((q, i) => {
              const w = weaknesses.find((w) => w.id === q.weaknessId);
              const isCurrent = i === currentIdx;
              const isResolved = q.weaknessId ? resolvedIds.has(q.weaknessId) : false;

              return (
                <button
                  key={q.id || i}
                  onClick={() => {
                    if (!isResolved && i !== currentIdx) {
                      setCurrentIdx(i);
                      setSelectedOption(null);
                      setAnswerState("idle");
                      setExplanation("");
                      setShowHint(false);
                    }
                  }}
                  disabled={isResolved}
                  className={`w-full text-left flex flex-col gap-1 p-3 rounded-xl transition-all ${
                    isCurrent
                      ? "bg-blue-50 border-l-[3px] border-blue-600"
                      : isResolved
                        ? "bg-gray-50 border-l-[3px] border-teal-400/50 opacity-80 cursor-default"
                        : "hover:bg-gray-50 border-l-[3px] border-transparent cursor-pointer"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-sm font-semibold leading-snug ${
                        isCurrent ? "text-blue-700" : isResolved ? "text-teal-600" : "text-gray-700"
                      }`}
                    >
                      {w?.topic || q.weaknessTopic || `Câu ${i + 1}`}
                    </span>
                    {isResolved ? (
                      <CheckCircle className="size-4 text-teal-500 shrink-0" />
                    ) : isCurrent ? (
                      <CircleDot className="size-4 text-blue-600 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-gray-300 shrink-0" />
                    )}
                  </div>
                  {isResolved && (
                    <p className="text-xs text-teal-500 font-medium">Đã hiểu</p>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <Link
              href="/mistakes"
              className="w-full py-2.5 px-4 bg-gray-100 text-gray-600 font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-all active:scale-95 text-sm"
            >
              <History className="size-4" />
              Quay lại danh sách
            </Link>
          </div>
        </aside>

        {/* ---- Mobile weakness tabs ---- */}
        <div className="lg:hidden w-full px-4 overflow-x-auto flex gap-2 pb-2 scroll-hide">
          {questions.map((q, i) => {
            const isCurrent = i === currentIdx;
            const isResolved = q.weaknessId ? resolvedIds.has(q.weaknessId) : false;
            const w = weaknesses.find((w) => w.id === q.weaknessId);
            return (
              <button
                key={q.id || i}
                onClick={() => {
                  if (!isResolved && i !== currentIdx) {
                    setCurrentIdx(i);
                    setSelectedOption(null);
                    setAnswerState("idle");
                    setExplanation("");
                    setShowHint(false);
                  }
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "bg-blue-600 text-white"
                    : isResolved
                      ? "bg-teal-100 text-teal-700 line-through"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {isResolved ? "✓ " : ""}{w?.topic || `Câu ${i + 1}`}
              </button>
            );
          })}
        </div>

        {/* ---- Main Practice Area ---- */}
        <div className="flex-1 min-w-0">
          <div className="max-w-3xl space-y-5 animate-fade-in">
            {/* Progress Card */}
            <div className="bg-white rounded-2xl p-5 flex items-center justify-between border border-blue-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-blue-50 text-blue-600">
                  <Brain className="size-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Trọng tâm luyện tập</h3>
                  <p className="text-sm text-gray-500">
                    {currentQ?.weaknessTopic || `Câu hỏi ${currentIdx + 1}/${totalQuestions}`}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  CÂU {currentIdx + 1}/{totalQuestions}
                </span>
              </div>
            </div>

            {/* Question Card */}
            <div
              className={`rounded-2xl p-6 border-l-[5px] shadow-sm transition-all ${
                answerState === "correct"
                  ? "bg-white border-teal-500"
                  : answerState === "incorrect"
                    ? "bg-white border-red-500"
                    : "bg-white border-blue-600"
              }`}
            >
              <span className="text-blue-600 font-bold text-[11px] uppercase tracking-wider block mb-2">
                CÂU HỎI LÝ THUYẾT
              </span>
              <h4 className="text-xl font-semibold mb-5 leading-relaxed text-gray-900">
                <MathText text={currentQ?.question || ""} />
              </h4>

              {/* Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQ?.options?.map((opt, i) => {
                  let borderClass = "border-gray-200 hover:border-blue-400 hover:bg-blue-50";
                  let circleClass = "border-gray-300 text-gray-500";

                  if (answerState !== "idle") {
                    if (i === correctIdx) {
                      borderClass = "border-teal-500 bg-teal-50";
                      circleClass = "bg-teal-500 text-white border-teal-500";
                    } else if (i === selectedOption && i !== correctIdx) {
                      borderClass = "border-red-400 bg-red-50";
                      circleClass = "bg-red-500 text-white border-red-500";
                    } else {
                      borderClass = "border-gray-200 bg-gray-50 opacity-50";
                      circleClass = "border-gray-300 text-gray-400";
                    }
                  } else if (i === selectedOption) {
                    borderClass = "border-blue-600 bg-blue-50 ring-2 ring-blue-600/20";
                    circleClass = "bg-blue-600 text-white border-blue-600";
                  }

                  return (
                    <button
                      key={i}
                      disabled={answerState !== "idle"}
                      onClick={() => setSelectedOption(i)}
                      className={`group flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${borderClass}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${circleClass} ${
                          answerState === "idle" && i !== selectedOption
                            ? "group-hover:border-blue-400 group-hover:text-blue-600"
                            : ""
                        }`}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <p className="text-sm pt-0.5 text-gray-700 leading-snug"><MathText text={opt.text} /></p>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setShowHint(true)}
                  className={`flex items-center gap-1.5 font-semibold text-sm transition-colors ${
                    showHint ? "text-gray-400 cursor-default" : "text-blue-600 hover:underline"
                  }`}
                  disabled={showHint}
                >
                  <Lightbulb className="size-4" />
                  {showHint ? "Đã hiện gợi ý" : "Xem gợi ý"}
                </button>

                <div className="flex gap-2">
                  {answerState === "idle" && (
                    <button
                      onClick={handleCheck}
                      disabled={selectedOption === null}
                      className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm"
                    >
                      Kiểm tra đáp án
                    </button>
                  )}
                  {answerState === "checking" && (
                    <button
                      disabled
                      className="px-8 py-2.5 rounded-xl font-bold bg-blue-400 text-white flex items-center gap-2 text-sm"
                    >
                      <Loader2 className="size-4 animate-spin" />
                      Đang kiểm tra...
                    </button>
                  )}
                  {(answerState === "correct" || answerState === "incorrect") && (
                    <button
                      onClick={handleNext}
                      className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                    >
                      {currentIdx < totalQuestions - 1 ? "Câu tiếp theo →" : "Hoàn thành"}
                    </button>
                  )}
                </div>
              </div>

              {/* Hint */}
              {showHint && currentQ?.explanation && (
                <div className="mt-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    💡 <MathText text={currentQ.explanation} />
                  </p>
                </div>
              )}

              {/* Feedback */}
              {answerState === "correct" && (
                <div className="mt-5 p-4 bg-teal-50 border border-teal-200 rounded-xl animate-slide-in">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-teal-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-teal-700 text-sm">Chính xác! 🎉</p>
                      <p className="text-sm text-teal-600 mt-0.5">Điểm yếu này đã được đánh dấu đã hiểu.</p>
                      {explanation && (
                        <p className="text-xs text-teal-700 mt-1.5"><MathText text={explanation} /></p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {answerState === "incorrect" && (
                <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl animate-slide-in">
                  <div className="flex items-start gap-3">
                    <span className="text-red-500 text-lg shrink-0 leading-none">✗</span>
                    <div>
                      <p className="font-bold text-red-700 text-sm">Chưa đúng</p>
                      <p className="text-sm text-red-600 mt-0.5">Điểm yếu này vẫn cần ôn tập thêm.</p>
                      {explanation && (
                        <p className="text-xs text-red-700 mt-1.5"><MathText text={explanation} /></p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Notes + Progress */}
            {currentWeakness && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <h5 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Brain className="size-5 text-blue-500" />
                    Ghi chú AI
                  </h5>
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                    <p className="text-sm text-gray-600 italic">
                      &ldquo;Hãy đọc kỹ câu hỏi và loại trừ các đáp án sai. Tập trung vào khái niệm cốt lõi:
                      <span className="font-semibold"> {currentWeakness.topic}</span>. Em đã sai {currentWeakness.errorCount} lần ở chủ đề này — cố gắng lên nhé!&rdquo;
                    </p>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <Zap className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>Mẹo: Đọc kỹ từ khoá trong câu hỏi trước khi chọn đáp án.</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <Zap className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>Nếu chưa chắc chắn, hãy dùng phương pháp loại trừ.</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-center">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-xl font-bold text-teal-600">{progressPct}%</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Tiến độ khắc phục</p>
                    <p className="text-xs text-gray-400 mt-0.5">{completedCount}/{totalQuestions} điểm yếu đã hiểu</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Page export with Suspense ----------

export default function PracticePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-10 text-blue-500 animate-spin" />
      </div>
    }>
      <PracticeContent />
    </Suspense>
  );
}
