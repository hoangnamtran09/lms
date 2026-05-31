"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  X,
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trophy,
  Target,
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GradingSheet } from "@/components/assignment/grading-sheet";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Assignment {
  id: string;
  title: string;
  description: string;
  rubric: string;
  maxScore: number;
  questions: string;
}

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileUrl: string;
  score: number | null;
  feedback: string;
  status: string;
  submittedAt: string;
  gradedAt: string | null;
  gradedBy: string;
}

interface McqOption {
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  score: number;
  type?: "mcq" | "short_answer";
  difficulty?: string;
  topic?: string;
  options?: McqOption[];
  explanation?: string;
}

const difficultyLabels: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
};

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

// Topic labels from difficulty or category
const topicLabel = (q: Question, index: number): string => {
  if (q.topic) return q.topic.toUpperCase();
  if (q.difficulty) return `CÂU HỎI ${String(index).padStart(2, "0")} — ${difficultyLabels[q.difficulty]?.toUpperCase() || "TỔNG HỢP"}`;
  return `CÂU HỎI ${String(index).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string; submissionId: string }>;
}) {
  const { id, submissionId } = use(params);
  const router = useRouter();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grading
  const [gradingSheetOpen, setGradingSheetOpen] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);

  // Feedback state
  const [globalFeedback, setGlobalFeedback] = useState("");
  const [perQuestionFeedback, setPerQuestionFeedback] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    Promise.all([
      api<Assignment>(`/api/assignments/${id}`),
      api<Submission[]>(`/api/assignments/${id}/submissions`),
    ])
      .then(([a, subs]) => {
        setAssignment(a);
        setAllSubmissions(subs);
        const sub = subs.find((s) => s.id === submissionId) || null;
        setSubmission(sub);
        if (!sub) setError("Không tìm thấy bài nộp");

        // Init per-question feedback from existing grading
        if (sub?.feedback) {
          const fbMap: Record<string, string> = {};
          try {
            const start = sub.feedback.indexOf("[");
            if (start >= 0) {
              const details = JSON.parse(sub.feedback.substring(start));
              if (Array.isArray(details)) {
                details.forEach(
                  (d: {
                    questionId: string;
                    score: number;
                    feedback: string;
                  }) => {
                    if (d.feedback && d.feedback !== "Đúng" && d.feedback !== "Sai" && d.feedback !== "Chưa trả lời") {
                      fbMap[d.questionId] = d.feedback;
                    }
                  }
                );
              }
            }
          } catch {}
          setPerQuestionFeedback(fbMap);

          // Extract global feedback (text before the JSON array)
          const bracketIdx = sub.feedback.indexOf("[");
          if (bracketIdx > 0) {
            setGlobalFeedback(sub.feedback.substring(0, bracketIdx).trim());
          } else if (bracketIdx === -1) {
            setGlobalFeedback(sub.feedback);
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, submissionId]);

  const handleAutoGrade = async () => {
    if (!submission) return;
    setAutoGrading(true);
    try {
      const result = await api<{
        score: number;
        feedback: string;
        details?: Array<{ questionId: string; feedback: string }>;
      }>(`/api/submissions/${submission.id}/auto-grade`, { method: "POST" });
      // Init per-question feedback from AI
      if (result.details) {
        const fbMap: Record<string, string> = {};
        result.details.forEach((d) => {
          if (d.feedback && d.feedback !== "Đúng" && d.feedback !== "Sai" && d.feedback !== "Chưa trả lời") {
            fbMap[d.questionId] = d.feedback;
          }
        });
        setPerQuestionFeedback((prev) => ({ ...prev, ...fbMap }));
      }
      // Reload
      const subs = await api<Submission[]>(
        `/api/assignments/${id}/submissions`
      );
      setAllSubmissions(subs);
      const updated = subs.find((s) => s.id === submissionId) || null;
      setSubmission(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi chấm bài");
    } finally {
      setAutoGrading(false);
    }
  };

  const handleGraded = () => {
    api<Submission[]>(`/api/assignments/${id}/submissions`)
      .then((subs) => {
        setAllSubmissions(subs);
        const updated = subs.find((s) => s.id === submissionId) || null;
        setSubmission(updated);
      })
      .catch(() => {});
  };

  // Saving state
  const [savingFeedback, setSavingFeedback] = useState(false);

  const handleSaveFeedback = async () => {
    if (!submission) return;
    setSavingFeedback(true);
    try {
      // Build the feedback string: global text + existing grading details merged with per-question feedback
      let feedbackStr = globalFeedback.trim();

      // Rebuild the grading details array, merging in per-question teacher notes
      const existingDetails: Array<{
        questionId: string;
        score: number;
        maxScore: number;
        feedback: string;
      }> = [];
      try {
        const fb = submission.feedback || "";
        const start = fb.indexOf("[");
        if (start >= 0) {
          const arr = JSON.parse(fb.substring(start));
          if (Array.isArray(arr)) existingDetails.push(...arr);
        }
      } catch {}

      if (existingDetails.length > 0 || Object.keys(perQuestionFeedback).length > 0) {
        const mergedDetails = existingDetails.map((d) => ({
          ...d,
          feedback: perQuestionFeedback[d.questionId] || d.feedback,
        }));
        // Add any new feedback entries for questions not in existing details
        for (const [qId, fb] of Object.entries(perQuestionFeedback)) {
          if (!mergedDetails.find((d) => d.questionId === qId)) {
            mergedDetails.push({
              questionId: qId,
              score: 0,
              maxScore: questions.find((q) => q.id === qId)?.score || 10,
              feedback: fb,
            });
          }
        }
        if (feedbackStr) feedbackStr += "\n";
        feedbackStr += JSON.stringify(mergedDetails);
      }

      await api(`/api/submissions/${submission.id}/grade`, {
        method: "PATCH",
        body: JSON.stringify({
          score: submission.score ?? 0,
          feedback: feedbackStr,
        }),
      });

      // Reload
      const subs = await api<Submission[]>(`/api/assignments/${id}/submissions`);
      setAllSubmissions(subs);
      const updated = subs.find((s) => s.id === submissionId) || null;
      setSubmission(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi lưu nhận xét");
    } finally {
      setSavingFeedback(false);
    }
  };

  // ---- Navigation ----
  const currentIndex = allSubmissions.findIndex((s) => s.id === submissionId);
  const prevSub = currentIndex > 0 ? allSubmissions[currentIndex - 1] : null;
  const nextSub =
    currentIndex < allSubmissions.length - 1
      ? allSubmissions[currentIndex + 1]
      : null;

  const navigateTo = (sub: Submission) => {
    router.push(`/teacher/assignments/${id}/submissions/${sub.id}`);
  };

  // ---- Parse data ----
  const questions: Question[] = (() => {
    if (!assignment?.questions) return [];
    try {
      const parsed = JSON.parse(assignment.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const answerMap = new Map<string, string>();
  try {
    if (submission?.content) {
      const parsed = JSON.parse(submission.content);
      if (parsed.answers) {
        parsed.answers.forEach(
          (a: { questionId: string; answer: string }) => {
            answerMap.set(a.questionId, a.answer || "");
          }
        );
      }
    }
  } catch {}

  const gradeMap = new Map<
    string,
    { score: number; maxScore: number; feedback: string }
  >();
  try {
    if (submission?.feedback) {
      const fb = submission.feedback;
      const start = fb.indexOf("[");
      if (start >= 0) {
        const details = JSON.parse(fb.substring(start));
        if (Array.isArray(details)) {
          details.forEach(
            (d: {
              questionId: string;
              score: number;
              maxScore: number;
              feedback: string;
            }) => {
              gradeMap.set(d.questionId, {
                score: d.score,
                maxScore: d.maxScore,
                feedback: d.feedback,
              });
            }
          );
        }
      }
    }
  } catch {}

  const isMcqQuestion = (q: Question) =>
    q.type === "mcq" || (q.options !== undefined && q.options.length > 0);

  const correctCount = Array.from(gradeMap.values()).filter(
    (g) => g.feedback === "Đúng"
  ).length;
  const wrongCount = Array.from(gradeMap.values()).filter(
    (g) => g.feedback === "Sai" || g.feedback === "Chưa trả lời"
  ).length;
  const scoreDisplay = submission?.score != null ? submission.score : 0;
  const submitDate = submission?.submittedAt
    ? new Date(submission.submittedAt)
    : null;
  const timeStr = submitDate
    ? submitDate.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
  const dateStr = submitDate ? submitDate.toLocaleDateString("vi-VN") : "--";
  const rank = currentIndex >= 0 ? currentIndex + 1 : 0;
  const completionPct =
    questions.length > 0
      ? Math.round(
          ((Array.from(answerMap.values()).filter((a) => a.trim() !== "")
            .length || (correctCount + wrongCount)) /
            questions.length) *
            100
        )
      : 0;

  // ---- Loading / Error ----
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-6xl pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !submission || !assignment) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <p className="text-gray-500">
          {error || "Không tìm thấy bài nộp"}
        </p>
        <Link
          href={`/teacher/assignments/${id}/submissions`}
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          Quay lại danh sách bài nộp
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      {/* Top bar: Back + Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href={`/teacher/assignments/${id}/submissions`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-medium">
            {currentIndex + 1} / {allSubmissions.length}
          </span>
          <button
            onClick={() => prevSub && navigateTo(prevSub)}
            disabled={!prevSub}
            className="size-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 shadow-sm transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => nextSub && navigateTo(nextSub)}
            disabled={!nextSub}
            className="size-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 shadow-sm transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Student Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-6">
          {/* Large avatar */}
          <div className="size-20 rounded-2xl overflow-hidden shadow-sm shrink-0 bg-blue-100 flex items-center justify-center">
            <span className="text-3xl font-bold text-blue-600">
              {submission.studentName?.charAt(0) || "?"}
            </span>
          </div>
          <div>
            <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-2">
              {submission.studentName}
            </h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                ID: {submission.studentId?.slice(0, 8) || "—"}
              </span>
              {submission.score != null ? (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center gap-1">
                  <Check className="size-4" />
                  Đã chấm — {submission.score}/{assignment.maxScore} điểm
                </span>
              ) : submission.status === "SUBMITTED" ? (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-bold flex items-center gap-1">
                  <Clock className="size-4" />
                  Chờ chấm
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-sm font-bold flex items-center gap-1">
                  {statusLabel[submission.status] || submission.status}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          {submission.score == null ? (
            <>
              <Button
                variant="outline"
                onClick={() => setGradingSheetOpen(true)}
                className="rounded-xl font-bold"
              >
                Chấm điểm thủ công
              </Button>
              <Button
                onClick={handleAutoGrade}
                disabled={autoGrading}
                className="gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-200"
              >
                <Sparkles className="size-4" />
                {autoGrading ? "Đang chấm..." : "Chấm AI"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setGradingSheetOpen(true)}
                className="rounded-xl font-bold"
              >
                Sửa điểm
              </Button>
              <Button
                onClick={handleSaveFeedback}
                disabled={savingFeedback}
                className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-200"
              >
                <Send className="size-4" />
                {savingFeedback ? "Đang lưu..." : "Hoàn tất nhận xét"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bento Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {/* Điểm số */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Target className="size-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Điểm số</p>
            <p className="text-2xl font-bold text-blue-600">
              {scoreDisplay}/{assignment.maxScore}
            </p>
          </div>
        </div>

        {/* Xếp hạng */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
            <Trophy className="size-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Xếp hạng</p>
            <p className="text-2xl font-bold text-pink-600">
              {rank}/{allSubmissions.length}
            </p>
          </div>
        </div>

        {/* Thời gian nộp */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Clock className="size-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Thời gian nộp</p>
            <p className="text-2xl font-bold text-emerald-600">
              {timeStr}
            </p>
            <p className="text-xs text-gray-400">{dateStr}</p>
          </div>
        </div>

        {/* Hoàn thành */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Target className="size-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Hoàn thành</p>
            <p className="text-2xl font-bold text-purple-600">
              {completionPct}%
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Questions + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Questions List */}
        <div className="flex-1 space-y-6">
          {questions.map((q, qi) => {
            const grade = gradeMap.get(q.id);
            const studentAns = answerMap.get(q.id) || "";
            const isMcq = isMcqQuestion(q);
            const isCorrect = grade?.feedback === "Đúng";
            const isWrong =
              grade?.feedback === "Sai" ||
              grade?.feedback === "Chưa trả lời";
            const isUnanswered = grade?.feedback === "Chưa trả lời";
            const options =
              isMcq && q.options && q.options.length > 0 ? q.options : [];
            const topic = topicLabel(q, qi + 1);

            return (
              <div
                key={q.id}
                id={`question-${qi}`}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
              >
                {/* Question header */}
                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        isCorrect
                          ? "bg-emerald-50 text-emerald-700"
                          : isWrong
                          ? "bg-pink-50 text-pink-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {topic}
                    </span>
                    {grade &&
                      (isCorrect ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1 text-sm">
                          <Check className="size-4" /> Chính xác
                        </span>
                      ) : isWrong ? (
                        <span className="text-red-500 font-bold flex items-center gap-1 text-sm">
                          <X className="size-4" />{" "}
                          {isUnanswered ? "Chưa trả lời" : "Sai sót"}
                        </span>
                      ) : null)}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {q.question}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">
                      {q.score || 10} điểm
                    </span>
                    {q.difficulty && (
                      <span className="text-xs text-gray-400">·</span>
                    )}
                    {q.difficulty && (
                      <span className="text-xs text-gray-400">
                        {difficultyLabels[q.difficulty] || q.difficulty}
                      </span>
                    )}
                  </div>
                </div>

                {/* MCQ Options */}
                {isMcq && options.length > 0 && (
                  <div className="p-6 space-y-3">
                    {options.map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi);
                      const isStudentChoice =
                        studentAns.toUpperCase() === letter;
                      const isCorrectOpt = opt.isCorrect;

                      // Stitch-style option rendering
                      if (isStudentChoice && isCorrectOpt) {
                        // Student chose correctly
                        return (
                          <div
                            key={oi}
                            className="flex items-center p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 relative"
                          >
                            <div className="size-6 rounded-full bg-emerald-500 text-white mr-4 flex items-center justify-center text-xs font-bold">
                              {letter}
                            </div>
                            <p className="text-base font-bold text-emerald-700">
                              {opt.text}
                            </p>
                            <Check className="absolute right-4 size-5 text-emerald-500" />
                          </div>
                        );
                      }
                      if (isStudentChoice && !isCorrectOpt) {
                        // Student chose wrong
                        return (
                          <div
                            key={oi}
                            className="flex items-center p-4 rounded-xl border-2 border-red-400 bg-red-50 relative"
                          >
                            <div className="size-6 rounded-full bg-red-500 text-white mr-4 flex items-center justify-center text-xs font-bold">
                              {letter}
                            </div>
                            <p className="text-base font-bold text-red-700">
                              {opt.text}
                            </p>
                            <span className="absolute right-4 text-xs text-red-500 font-medium">
                              HS chọn
                            </span>
                          </div>
                        );
                      }
                      if (!isStudentChoice && isCorrectOpt && grade) {
                        // Correct answer (not chosen by student)
                        return (
                          <div
                            key={oi}
                            className="flex items-center p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 relative"
                          >
                            <div className="size-6 rounded-full bg-emerald-500 text-white mr-4 flex items-center justify-center text-xs font-bold">
                              {letter}
                            </div>
                            <p className="text-base font-bold text-emerald-700">
                              {opt.text}
                            </p>
                            <span className="absolute right-4 text-xs text-emerald-600 font-bold flex items-center gap-1">
                              <Check className="size-3.5" /> Đáp án
                            </span>
                          </div>
                        );
                      }
                      // Normal unselected option
                      return (
                        <div
                          key={oi}
                          className="flex items-center p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <div className="size-6 rounded-full border-2 border-gray-300 text-gray-500 mr-4 flex items-center justify-center text-xs font-bold">
                            {letter}
                          </div>
                          <p className="text-base text-gray-600">
                            {opt.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Short answer */}
                {!isMcq && (
                  <div className="p-6 space-y-4">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Câu trả lời của học sinh
                      </p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {studentAns || (
                          <span className="italic text-gray-400">
                            (không trả lời)
                          </span>
                        )}
                      </p>
                    </div>
                    {q.expectedAnswer && (
                      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">
                          Đáp án mong đợi
                        </p>
                        <p className="text-sm text-gray-700">
                          {q.expectedAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Per-question Teacher Feedback */}
                <div className="px-6 pb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                      <MessageSquare className="size-4" />
                      <span className="font-bold text-sm">
                        Phản hồi của giáo viên
                      </span>
                    </div>
                    <textarea
                      className="w-full bg-transparent border-none focus:ring-0 text-sm p-0 resize-none h-16 placeholder:text-gray-300"
                      placeholder="Nhập nhận xét chi tiết cho câu này..."
                      value={perQuestionFeedback[q.id] || ""}
                      onChange={(e) =>
                        setPerQuestionFeedback((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {questions.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <MessageSquare className="size-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400">
                Bài tập này không có câu hỏi chi tiết
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar (320px) */}
        <aside className="lg:w-[320px] space-y-6">
          {/* Question Navigation Grid */}
          {questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Danh sách câu hỏi
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, qi) => {
                  const grade = gradeMap.get(q.id);
                  const isCorrect = grade?.feedback === "Đúng";
                  const isWrong =
                    grade?.feedback === "Sai" ||
                    grade?.feedback === "Chưa trả lời";
                  let btnColor = "bg-gray-100 text-gray-500 border border-gray-200";
                  if (isCorrect)
                    btnColor = "bg-emerald-500 text-white";
                  else if (isWrong)
                    btnColor = "bg-red-500 text-white";

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const el = document.getElementById(`question-${qi}`);
                        if (el)
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                      className={`size-10 rounded-lg font-bold text-sm flex items-center justify-center hover:opacity-80 transition-opacity ${btnColor}`}
                    >
                      {qi + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex gap-4 text-xs font-bold text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded-sm bg-emerald-500" /> Đúng
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded-sm bg-red-500" /> Sai
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-3 rounded-sm bg-gray-200 border" />{" "}
                  Chưa làm
                </span>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {gradeMap.size > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 bg-purple-50 rounded-bl-2xl text-purple-600">
                <Sparkles className="size-5" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Phân tích AI
              </h4>
              <div className="space-y-4">
                {wrongCount > 0 && (
                  <div className="p-3 bg-red-50 rounded-xl border-l-4 border-red-500">
                    <p className="text-sm font-bold text-red-600 mb-1 flex items-center gap-1">
                      <AlertTriangle className="size-3.5" />
                      Điểm yếu cần cải thiện
                    </p>
                    <p className="text-sm text-gray-600">
                      Học sinh gặp khó khăn ở {wrongCount}/{questions.length}{" "}
                      câu hỏi. Cần ôn tập thêm kiến thức nền tảng.
                    </p>
                  </div>
                )}
                {correctCount > 0 && (
                  <div className="p-3 bg-emerald-50 rounded-xl border-l-4 border-emerald-500">
                    <p className="text-sm font-bold text-emerald-600 mb-1 flex items-center gap-1">
                      <ThumbsUp className="size-3.5" />
                      Điểm mạnh
                    </p>
                    <p className="text-sm text-gray-600">
                      Trả lời đúng {correctCount}/{questions.length} câu hỏi.
                      Tư duy logic tốt ở các câu đã làm đúng.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Global Feedback */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Nhận xét tổng quát
            </h4>
            <textarea
              className="w-full bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm p-4 h-32 mb-4 resize-none"
              placeholder="Viết nhận xét cho toàn bộ bài kiểm tra..."
              value={globalFeedback}
              onChange={(e) => setGlobalFeedback(e.target.value)}
            />
            <button
              onClick={handleSaveFeedback}
              disabled={savingFeedback}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {savingFeedback ? "Đang lưu..." : "Gửi nhận xét"}
            </button>
          </div>

          {/* Other Submissions */}
          {allSubmissions.length > 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-3">
                Bài nộp khác
              </h4>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {allSubmissions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigateTo(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      s.id === submissionId
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="size-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {s.studentName?.charAt(0) || "?"}
                        </span>
                        <span>{s.studentName}</span>
                      </span>
                      {s.score != null && (
                        <span className="text-xs font-bold">
                          {s.score}/{assignment.maxScore}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Grading Sheet Dialog */}
      <GradingSheet
        open={gradingSheetOpen}
        onOpenChange={setGradingSheetOpen}
        submissions={allSubmissions}
        questions={questions}
        maxScore={assignment.maxScore}
        rubric={assignment.rubric || ""}
        initialIndex={currentIndex >= 0 ? currentIndex : 0}
        onGraded={handleGraded}
      />
    </div>
  );
}
