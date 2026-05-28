"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  dueDate: string;
  status: string;
  source: string;
  creatorName: string;
  questions: string;
  createdAt: string;
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
  options?: McqOption[];
  explanation?: string;
}

const difficultyLabels: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
};

const difficultyColors: Record<string, string> = {
  nhan_biet: "bg-emerald-100 text-emerald-700 border-emerald-200",
  thong_hieu: "bg-blue-100 text-blue-700 border-blue-200",
  van_dung: "bg-orange-100 text-orange-700 border-orange-200",
};

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

interface QuestionResult {
  questionId: string;
  question: string;
  score: number;
  maxScore: number;
  feedback: string;
}

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSubmissionJson(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (parsed.answers && Array.isArray(parsed.answers)) {
      const answerMap = new Map(
        parsed.answers.map((a: { questionId: string; answer: string }) => [a.questionId, a.answer])
      );
      return { type: "answers" as const, answerMap, parsed, content };
    }
    if (parsed.summary) {
      return { type: "summary" as const, summary: parsed.summary };
    }
  } catch {}
  return null;
}

function SubmissionContent({ content, questions }: { content: string; questions: Question[] }) {
  const parsed = parseSubmissionJson(content);

  if (parsed?.type === "answers") {
    return (
      <div className="space-y-1.5 mb-2">
        {questions.map((q, i) => (
          <div key={q.id} className="text-sm flex items-center gap-2">
            <span className="font-medium text-gray-700 shrink-0">Câu {i + 1}:</span>
            {q.difficulty && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {difficultyLabels[q.difficulty] || q.difficulty}
              </span>
            )}
            <span className="text-gray-600 truncate">{String(parsed.answerMap.get(q.id) || "(không trả lời)")}</span>
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{parsed.parsed.summary || content}</p>
        )}
      </div>
    );
  }

  if (parsed?.type === "summary") {
    return <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{parsed.summary}</p>;
  }

  return <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{content}</p>;
}

function tryParseJsonFromText(text: string): { prefix: string; details: QuestionResult[] } | null {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { prefix: "", details: parsed };
  } catch {}
  // Find JSON array in text (handles "Tổng điểm: 4/10\n[{...}]")
  const start = text.indexOf("[");
  if (start > 0) {
    try {
      const prefix = text.substring(0, start).trim();
      const jsonPart = text.substring(start);
      const parsed = JSON.parse(jsonPart);
      if (Array.isArray(parsed)) return { prefix, details: parsed };
    } catch {}
  }
  return null;
}

function GradingDetails({ feedback }: { feedback: string }) {
  const parsed = tryParseJsonFromText(feedback);
  if (parsed && parsed.details.length > 0) {
    return (
      <div className="mt-2">
        {parsed.prefix && (
          <p className="text-xs font-medium text-gray-600 mb-1">{parsed.prefix}</p>
        )}
        <div className="space-y-1">
          {parsed.details.map((d, i) => (
            <div key={d.questionId} className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-medium">C{i + 1}:</span>
              <Badge variant="outline" className="text-xs">{d.score}/{d.maxScore}</Badge>
              <span className="truncate">{d.feedback}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <p className="text-sm text-gray-600 mt-2 w-full">{feedback}</p>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAssignmentDetailPage({
  params,
  basePath = "/admin",
}: {
  params: Promise<{ id: string }>;
  basePath?: string;
}) {
  const { id } = use(params);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grading state
  const [gradingSheetOpen, setGradingSheetOpen] = useState(false);
  const [gradingSheetIndex, setGradingSheetIndex] = useState(0);
  const [autoGrading, setAutoGrading] = useState(false);

  const loadData = () => {
    Promise.all([
      api<Assignment>(`/api/assignments/${id}`),
      api<Submission[]>(`/api/assignments/${id}/submissions`),
    ])
      .then(([a, s]) => { setAssignment(a); setSubmissions(s); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { loadData(); }, [id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleAutoGrade = async (submissionId: string) => {
    setAutoGrading(true);
    try {
      await api(`/api/submissions/${submissionId}/auto-grade`, { method: "POST" });
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setAutoGrading(false);
    }
  };

  // Parse questions
  const questions: Question[] = (() => {
    if (!assignment?.questions) return [];
    try {
      const parsed = JSON.parse(assignment.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const gradedCount = submissions.filter((s) => s.score != null).length;
  const ungradedCount = submissions.filter((s) => s.status === "SUBMITTED" && s.score == null).length;

  // ---- Loading / Error states ----
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in max-w-6xl">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-40 w-full rounded-lg" />
        <Skeleton delay={200} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <p className="text-gray-500">{error || "Không tìm thấy bài tập"}</p>
        <Link href={`${basePath}/assignments`} className="text-sm text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Back link */}
      <Link
        href={`${basePath}/assignments`}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>

      {/* Assignment header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
              <Badge variant="outline" className="text-xs">
                {statusLabel[assignment.status] || assignment.status}
              </Badge>
              {assignment.source === "weakness" && (
                <Badge className="text-xs bg-amber-100 text-amber-700">Khắc phục</Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {assignment.description || "Không có mô tả"}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500 shrink-0 ml-4 space-y-0.5">
            <p>Điểm tối đa: <span className="font-semibold">{assignment.maxScore}</span></p>
            {assignment.dueDate && (
              <p>Hạn: {new Date(assignment.dueDate).toLocaleDateString("vi-VN")}</p>
            )}
            {assignment.creatorName && <p>Giáo viên: {assignment.creatorName}</p>}
            {questions.length > 0 && <p>{questions.length} câu hỏi</p>}
            {questions.some((q) => q.difficulty) && (
              <div className="flex items-center gap-1.5 mt-1">
                {["nhan_biet", "thong_hieu", "van_dung"].map((d) => {
                  const count = questions.filter((q) => q.difficulty === d).length;
                  if (count === 0) return null;
                  return (
                    <span key={d} className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[d] || ""}`}>
                      {difficultyLabels[d]}: {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {assignment.rubric && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-gray-700">
            <span className="font-medium">Tiêu chí chấm:</span> {assignment.rubric}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100">
            <FileText className="size-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Tổng bài nộp</p>
            <p className="text-xl font-bold text-gray-900">{submissions.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-100">
            <FileText className="size-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Đã chấm</p>
            <p className="text-xl font-bold text-gray-900">{gradedCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-amber-100">
            <FileText className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Cần chấm</p>
            <p className="text-xl font-bold text-amber-600">{ungradedCount}</p>
          </div>
        </div>
      </div>

      {/* Submissions list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            Bài nộp của học sinh ({submissions.length})
          </h2>
        </div>
        {submissions.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="size-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Chưa có học sinh nào nộp bài</p>
          </div>
        ) : (
          <div className="divide-y">
            {submissions.map((sub, idx) => {
              const isUngraded = sub.status === "SUBMITTED" && sub.score == null;
              const isReturned = sub.status === "RETURNED";
              const isGraded = sub.score != null;
              let rowStyle = "";
              if (isReturned) rowStyle = "border-l-2 border-l-amber-400 bg-amber-50/40";
              else if (isUngraded) rowStyle = "border-l-2 border-l-blue-400 bg-blue-50/40";
              else if (isGraded) rowStyle = "border-l-2 border-l-emerald-300";

              return (
                <div key={sub.id} className={`px-6 py-4 ${rowStyle}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{sub.studentName}</span>
                      <span className="text-sm text-gray-400 ml-2">
                        {new Date(sub.submittedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.score != null && (
                        <Badge variant="default" className="text-xs font-semibold">
                          {sub.score}/{assignment.maxScore}
                        </Badge>
                      )}
                      {isUngraded && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          Cần chấm
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {statusLabel[sub.status] || sub.status}
                      </Badge>
                    </div>
                  </div>
                  <SubmissionContent content={sub.content} questions={questions} />
                  {sub.feedback && (
                    <GradingDetails feedback={sub.feedback} />
                  )}

                  <div className="flex gap-2 mt-2">
                    {sub.score == null && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setGradingSheetIndex(idx);
                            setGradingSheetOpen(true);
                          }}
                        >
                          Chấm điểm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAutoGrade(sub.id)}
                          disabled={autoGrading}
                        >
                          <Sparkles className="size-3 mr-1" />
                          {autoGrading ? "Đang chấm..." : "Chấm AI"}
                        </Button>
                      </>
                    )}
                    {sub.score != null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setGradingSheetIndex(idx);
                          setGradingSheetOpen(true);
                        }}
                      >
                        Xem / sửa điểm
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grading Dialog */}
      <GradingSheet
        open={gradingSheetOpen}
        onOpenChange={setGradingSheetOpen}
        submissions={submissions}
        questions={questions}
        maxScore={assignment.maxScore}
        rubric={assignment.rubric || ""}
        initialIndex={gradingSheetIndex}
        onGraded={loadData}
      />
    </div>
  );
}
