"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import {
  Send,
  FileText,
  Check,
  X,
  Upload,
  Loader2,
  Calendar,
  Clock3,
  CloudUpload,
  Timer,
  HelpCircle,
  MessageCircle,
  Paperclip,
  ChevronRight,
  User,
  AlertTriangle,
} from "lucide-react";
import { api, uploadFile } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RemediationExercise } from "@/components/ai/remediation-exercise";
import type { RemediationQuestion, ExerciseAnswer } from "@/components/ai/remediation-exercise";
import { MathText } from "@/components/ai/math-text";

// ---- Interfaces -----------------------------------------------------------

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

interface QuestionResult {
  questionId: string;
  question: string;
  score: number;
  maxScore: number;
  feedback: string;
  correctAnswer?: string;
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

// ---- Constants ------------------------------------------------------------

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

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

const statusBadgeStyle: Record<string, string> = {
  ASSIGNED: "bg-red-50 text-red-700",
  SUBMITTED: "bg-gray-100 text-gray-600",
  GRADED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-red-50 text-red-700 border-red-300",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
};

// ---- Helpers --------------------------------------------------------------

function parseInlineMcqOptions(questionText: string): McqOption[] {
  const lines = questionText.split(/\n/);
  const options: McqOption[] = [];
  const letterRegex = /^([A-D])[.)]\s*(.+)$/;
  for (const line of lines) {
    const m = line.trim().match(letterRegex);
    if (m) {
      options.push({ text: m[2], isCorrect: false });
    }
  }
  if (options.length >= 2 && options.length <= 6) return options;
  return [];
}

function isMcqQuestion(q: Question): boolean {
  return q.type === "mcq" || (q.options !== undefined && q.options.length > 0);
}

function isOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (d.getFullYear() <= 1) return "";
  return `${d.getDate().toString().padStart(2, "0")} Tháng ${d.getMonth() + 1}`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN");
}

// ---- Component ------------------------------------------------------------

export default function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Student state
  const [answer, setAnswer] = useState("");
  const [perQuestionAnswers, setPerQuestionAnswers] = useState<Record<string, string>>({});
  const [mcqSelections, setMcqSelections] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mySubmitted, setMySubmitted] = useState(() => {
    try { return sessionStorage.getItem(`submitted-${id}`) === "true"; } catch { return false; }
  });
  const [submitResults, setSubmitResults] = useState<QuestionResult[] | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, setFileUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mySubmission = submissions.find((s) => s.studentId === user?.id);

  // Weakness auto-resolve tracking
  const [weaknessId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("weaknessId"));
  const correctRef = useRef(new Set<number>());
  const attemptedRef = useRef(new Set<number>());
  const answersRef = useRef<(ExerciseAnswer | null)[]>([]);
  const [allExercisesCorrect, setAllExercisesCorrect] = useState(false);
  const submittingRef = useRef(false);

  const handleExerciseCorrect = (index: number) => {
    if (correctRef.current.has(index)) return;
    correctRef.current.add(index);
    if (correctRef.current.size === weaknessExercises.length && weaknessId) {
      setAllExercisesCorrect(true);
      api(`/api/weaknesses/${weaknessId}/resolve`, { method: "POST" }).catch(() => {});
    }
  };

  const handleExerciseAnswer = (index: number, answer: ExerciseAnswer) => {
    answersRef.current[index] = answer;
  };

  const handleExerciseAttempt = (index: number) => {
    if (attemptedRef.current.has(index)) return;
    attemptedRef.current.add(index);
    if (attemptedRef.current.size === weaknessExercises.length && !submittingRef.current) {
      submittingRef.current = true;
      api(`/api/assignments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          assignmentId: id,
          content: JSON.stringify({
            summary: "Đã hoàn thành bài tập khắc phục điểm yếu.",
            answers: answersRef.current,
          }),
        }),
      })
        .then(() => {
          setSubmitted(true);
        })
        .catch(() => {})
        .finally(() => { submittingRef.current = false; });
    }
  };

  // Parse weakness exercises
  const weaknessExercises: RemediationQuestion[] = (() => {
    if (assignment?.source !== "weakness" || !assignment?.description) return [];
    try {
      const parsed = JSON.parse(assignment.description);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Restore previous answers
  const previousAnswers: (ExerciseAnswer | null)[] = (() => {
    if (!mySubmission?.content) return [];
    try {
      const parsed = JSON.parse(mySubmission.content);
      return Array.isArray(parsed.answers) ? parsed.answers : [];
    } catch {
      return [];
    }
  })();

  // Parse questions
  const questions: Question[] = (() => {
    if (!assignment?.questions) return [];
    try {
      const parsed = JSON.parse(assignment.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Parse grading details
  const gradingDetails: QuestionResult[] = (() => {
    if (!mySubmission?.feedback) return [];
    try {
      const parsed = JSON.parse(mySubmission.feedback);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    const start = mySubmission.feedback.indexOf("[");
    if (start > 0) {
      try {
        const parsed = JSON.parse(mySubmission.feedback.substring(start));
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  })();

  const loadData = () => {
    Promise.all([
      api<Assignment>(`/api/assignments/${id}`),
      api<Submission[]>(`/api/assignments/${id}/submissions`),
    ])
      .then(([a, s]) => {
        setAssignment(a);
        setSubmissions(s);
        if (s.length > 0) setSubmitted(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (questions.length === 0) return;
    const content = mySubmission?.content || (() => {
      try { return sessionStorage.getItem(`submitted-${id}-content`); } catch { return null; }
    })();
    if (!content) return;
    try {
      const parsed = JSON.parse(content);
      if (parsed.answers && Array.isArray(parsed.answers)) {
        const selections: Record<string, number> = {};
        const texts: Record<string, string> = {};
        parsed.answers.forEach((a: { questionId: string; answer: string }) => {
          const q = questions.find((q) => q.id === a.questionId);
          if (!q) return;
          if (isMcqQuestion(q)) {
            const idx = a.answer ? a.answer.toUpperCase().charCodeAt(0) - 65 : -1;
            if (idx >= 0 && idx < 4) selections[q.id] = idx;
          } else {
            texts[q.id] = a.answer || "";
          }
        });
        setMcqSelections(selections);
        setPerQuestionAnswers(texts);
        setMySubmitted(true);
        try { sessionStorage.setItem(`submitted-${id}`, "true"); } catch {}
      }
    } catch {}
  }, [mySubmission, questions, id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async () => {
    if (mySubmission || mySubmitted || submitting) return;
    const hasQuestions = questions.length > 0;
    if (!hasQuestions && !answer.trim() && !selectedFile) return;
    if (hasQuestions) {
      const anyMcqAnswered = questions.some((q) => isMcqQuestion(q) && mcqSelections[q.id] != null);
      const anyShortAnswered = questions.some((q) => !isMcqQuestion(q) && perQuestionAnswers[q.id]?.trim());
      if (!anyMcqAnswered && !anyShortAnswered && !selectedFile) return;
    }
    setSubmitting(true);

    let uploadedUrl = "";
    if (selectedFile) {
      setUploading(true);
      try {
        const result = await uploadFile("/api/submissions/upload", selectedFile);
        uploadedUrl = result.url;
        setFileUrl(uploadedUrl);
      } catch (e: unknown) {
        setError("Tải file thất bại: " + (e instanceof Error ? e.message : "Lỗi không xác định"));
        setSubmitting(false);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    try {
      const content = hasQuestions
        ? JSON.stringify({
            answers: questions.map((q) => ({
              questionId: q.id,
              answer: isMcqQuestion(q)
                ? String.fromCharCode(65 + (mcqSelections[q.id] ?? 0))
                : (perQuestionAnswers[q.id] || ""),
            })),
          })
        : answer;
      const res = await api<{ submission: Submission; results: QuestionResult[] }>(`/api/assignments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ assignmentId: id, content, fileUrl: uploadedUrl }),
      });
      setSubmissions((prev) => [...prev, res.submission]);
      setSubmitResults(res.results);
      setSubmitted(true);
      setMySubmitted(true);
      setAnswer("");
      setSelectedFile(null);
      try {
        sessionStorage.setItem(`submitted-${id}`, "true");
        sessionStorage.setItem(`submitted-${id}-content`, content);
      } catch {}
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers for question nav
  const isQuestionAnswered = (q: Question): boolean => {
    if (isMcqQuestion(q)) return mcqSelections[q.id] != null;
    return !!perQuestionAnswers[q.id]?.trim();
  };
  const answeredCount = questions.filter(isQuestionAnswered).length;

  const scrollToQuestion = (index: number) => {
    const el = document.getElementById(`question-${index}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ---- Render ------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-8">
        <Skeleton delay={0} className="h-6 w-64 mb-6" />
        <div className="flex gap-6">
          <div className="flex-1 space-y-6">
            <Skeleton delay={80} className="h-48 rounded-2xl" />
            <Skeleton delay={160} className="h-64 rounded-2xl" />
          </div>
          <div className="w-80 space-y-6">
            <Skeleton delay={240} className="h-40 rounded-2xl" />
            <Skeleton delay={320} className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-gray-900">{error || "Không tìm thấy bài tập"}</p>
        <Link href="/assignments" className="text-sm text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  const overdue = isOverdue(assignment.dueDate);
  const effectiveStatus = mySubmission
    ? mySubmission.status
    : mySubmitted
    ? "SUBMITTED"
    : assignment.status;
  const isGraded = !!mySubmission || !!submitResults;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 mb-6 text-gray-500">
        <Link href="/assignments" className="text-sm hover:text-primary transition-colors">
          Danh sách bài tập
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-sm text-gray-900 font-semibold truncate">{assignment.title}</span>
      </nav>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ======== LEFT COLUMN: Main Content ======== */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Hero Section — Assignment Details */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
              <div className="flex-1">
                {/* Due date badge */}
                {assignment.dueDate && new Date(assignment.dueDate).getFullYear() > 1 && (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 ${
                      overdue
                        ? "bg-red-100 text-red-700 border-2 border-red-300"
                        : "bg-amber-50 text-amber-700 border border-amber-300"
                    }`}
                  >
                    <Calendar className="size-3 inline mr-1" />
                    {overdue ? "Quá hạn: " : "Hạn chót: "}
                    {formatDate(assignment.dueDate)}
                  </span>
                )}
                <h1 className="text-[32px] font-bold tracking-[-0.02em] text-primary mb-1">
                  Chi tiết bài tập
                </h1>
                <h2 className="text-xl font-semibold text-gray-700">
                  {assignment.title}
                </h2>
              </div>
              {/* Max Score */}
              <div className="flex flex-col items-end shrink-0">
                <span className="text-sm text-gray-500">Điểm tối đa</span>
                <span className="text-[32px] font-bold tracking-[-0.02em] text-primary">
                  {assignment.maxScore}
                </span>
              </div>
            </div>

            {/* Description / Instructions */}
            <div className="prose prose-slate max-w-none text-gray-700">
              {weaknessExercises.length > 0 ? (
                <div className="space-y-3">
                  {allExercisesCorrect && (
                    <div className="p-3 bg-green-50 rounded-xl text-sm text-green-700 flex items-center gap-2">
                      <Check className="size-4" />
                      Bạn đã hoàn thành tất cả bài tập — điểm yếu này đã được xoá.
                    </div>
                  )}
                  {!allExercisesCorrect && mySubmission && (
                    <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700 flex items-center gap-2">
                      <FileText className="size-4" />
                      Bạn đã nộp bài. Các câu trả lời trước đây của bạn được hiển thị bên dưới.
                    </div>
                  )}
                  {weaknessExercises.map((ex, i) => (
                    <RemediationExercise
                      key={i}
                      exercise={ex}
                      onCorrect={() => handleExerciseCorrect(i)}
                      onAttempt={() => handleExerciseAttempt(i)}
                      onAnswer={(ans) => handleExerciseAnswer(i, ans)}
                      disabled={submitted || !!mySubmission}
                      initialAnswer={previousAnswers[i] ?? null}
                    />
                  ))}
                </div>
              ) : questions.length > 0 ? (
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Hướng dẫn chi tiết:</h4>
                  {assignment.description && (
                    <p className="mb-4 text-gray-600 whitespace-pre-wrap">{assignment.description}</p>
                  )}
                  {assignment.rubric && (
                    <div className="p-4 bg-amber-50 rounded-xl text-sm text-gray-700 mb-4">
                      <span className="font-medium">Tiêu chí chấm:</span> {assignment.rubric}
                    </div>
                  )}
                  {/* Question Navigation */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-sm font-semibold text-blue-700">
                      {answeredCount}/{questions.length} câu đã làm
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      {questions.map((q, i) => {
                        const answered = isQuestionAnswered(q);
                        return (
                          <button
                            key={q.id}
                            onClick={() => scrollToQuestion(i)}
                            title={`Câu ${i + 1}${answered ? " (đã làm)" : " (chưa làm)"}`}
                            className={`flex items-center justify-center size-7 rounded-md text-[10px] font-bold transition-all border hover:scale-105 ${
                              answered
                                ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                                : "bg-white border-gray-300 text-gray-400 hover:border-gray-500 hover:text-gray-600"
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                assignment.description && (
                  <p className="whitespace-pre-wrap text-gray-700">{assignment.description}</p>
                )
              )}

              {/* Teacher info (inline for mobile) */}
              <div className="mt-5 pt-5 border-t border-gray-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary">
                  <User className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{assignment.creatorName || "Giáo viên"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Questions Section (only before submission) */}
          {questions.length > 0 && !mySubmission && (
            <div className="space-y-4">
              {questions.map((q, i) => {
                const mcq = isMcqQuestion(q);
                const selection = mcqSelections[q.id];
                const shortAnswer = perQuestionAnswers[q.id] || "";
                const allResults = submitResults && submitResults.length > 0 ? submitResults : gradingDetails;
                const resultMap = new Map<string, QuestionResult>();
                allResults.forEach((r) => resultMap.set(r.questionId, r));
                const gradeResult = resultMap.get(q.id);

                return (
                  <div
                    key={q.id}
                    id={`question-${i}`}
                    className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm scroll-mt-6"
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-sm font-bold text-purple-600 shrink-0 mt-0.5">Câu {i + 1}</span>
                      <span className="text-xs text-gray-400">({q.score || 10}đ)</span>
                      {q.difficulty && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                            difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          {difficultyLabels[q.difficulty] || q.difficulty}
                        </span>
                      )}
                      {gradeResult && (
                        <Badge variant={gradeResult.feedback === "Đúng" ? "default" : "outline"} className="text-xs">
                          {gradeResult.feedback === "Đúng" ? "Đúng" : "Sai"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap mb-3">
                      <MathText text={q.question} />
                    </p>
                    {mcq ? (
                      <div className="space-y-1.5">
                        {(q.options && q.options.length > 0
                          ? q.options
                          : parseInlineMcqOptions(q.question)
                        ).map((opt, idx) => {
                          const letter = String.fromCharCode(65 + idx);
                          let btnStyle =
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition border flex items-center gap-2 ";
                          if (!isGraded) {
                            btnStyle += selection === idx
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-white border-gray-200 hover:border-primary/50 cursor-pointer";
                          } else {
                            const isSelected = selection === idx;
                            const isCorrect = gradeResult?.feedback === "Đúng";
                            if (isSelected && isCorrect) {
                              btnStyle += "bg-green-50 border-green-300 text-green-800";
                            } else if (isSelected && !isCorrect) {
                              btnStyle += "bg-red-50 border-red-300 text-red-800";
                            } else {
                              btnStyle += "bg-white border-gray-100 text-gray-400";
                            }
                          }
                          return (
                            <button
                              key={idx}
                              className={btnStyle}
                              onClick={() => {
                                if (!isGraded) setMcqSelections((prev) => ({ ...prev, [q.id]: idx }));
                              }}
                              disabled={isGraded}
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                                {letter}
                              </span>
                              <span className="flex-1"><MathText text={opt.text} /></span>
                              {isGraded && selection === idx &&
                                (gradeResult?.feedback === "Đúng" ? (
                                  <Check className="size-4 text-green-600 shrink-0" />
                                ) : (
                                  <X className="size-4 text-red-600 shrink-0" />
                                ))}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Textarea
                        value={(() => {
                          const storedContent = (() => { try { return sessionStorage.getItem(`submitted-${id}-content`); } catch { return null; } })();
                          if (storedContent) {
                            try {
                              const parsed = JSON.parse(storedContent);
                              const ans = parsed.answers?.find(
                                (a: { questionId: string; answer: string }) => a.questionId === q.id
                              );
                              return ans?.answer || "";
                            } catch { return ""; }
                          }
                          return shortAnswer;
                        })()}
                        onChange={(e) => setPerQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Nhập câu trả lời của bạn..."
                        rows={3}
                        disabled={isGraded}
                      />
                    )}
                    {/* Result + explanation */}
                    {isGraded && (
                      <div
                        className={`mt-3 p-3 rounded-xl text-sm ${
                          gradeResult
                            ? gradeResult.feedback === "Đúng"
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                            : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {gradeResult ? (
                            gradeResult.feedback === "Đúng" ? (
                              <><Check className="size-4 text-green-600" /><span className="font-medium text-green-700">Đúng</span></>
                            ) : (
                              <><X className="size-4 text-red-600" /><span className="font-medium text-red-700">Sai</span></>
                            )
                          ) : (
                            <><FileText className="size-4 text-blue-600" /><span className="font-medium text-blue-700">Đã nộp</span></>
                          )}
                        </div>
                        {mcq && gradeResult && gradeResult.feedback !== "Đúng" && gradeResult.correctAnswer && (
                          <p className="text-xs text-gray-600 mb-1">
                            Đáp án đúng: <span className="font-medium">{gradeResult.correctAnswer}</span>
                          </p>
                        )}
                        {q.explanation && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Giải thích:</span> <MathText text={q.explanation} />
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Submission Area */}
          {!mySubmission && !mySubmitted && assignment.source !== "weakness" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Upload Card */}
              <div className="bg-white rounded-2xl p-6 border border-primary/20 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <CloudUpload className="size-24 text-primary" />
                </div>
                <h4 className="text-lg font-semibold text-primary mb-4">Nộp tệp tin</h4>

                {/* Drop zone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-primary transition-all cursor-pointer group"
                >
                  <CloudUpload className="size-10 text-gray-400 group-hover:text-primary transition-colors" />
                  <p className="text-sm text-gray-500 text-center">
                    Kéo thả tệp hoặc <span className="text-primary font-bold">chọn tệp</span> từ máy tính
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">PDF, DOCX, ZIP (Max 50MB)</p>
                </div>
                {selectedFile && (
                  <div className="mt-3 flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm">
                    <Paperclip className="size-4 text-primary" />
                    <span className="text-gray-700 truncate flex-1">{selectedFile.name}</span>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {selectedFile && (
                  <div className="mt-2 max-w-xs rounded-xl overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Preview"
                      className="w-full h-auto max-h-40 object-contain bg-gray-50"
                    />
                  </div>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || uploading || !selectedFile}
                  className="w-full mt-6 py-4 rounded-xl text-base font-bold"
                  size="lg"
                >
                  {uploading ? (
                    <><Loader2 className="size-5 mr-2 animate-spin" /> Đang tải lên...</>
                  ) : submitting ? (
                    <><Loader2 className="size-5 mr-2 animate-spin" /> Đang nộp...</>
                  ) : (
                    <><Send className="size-5 mr-2" /> Nộp bài</>
                  )}
                </Button>
              </div>

              {/* Alternative: Direct text / quiz submission */}
              <div className="bg-emerald-600 text-white rounded-2xl p-6 border border-emerald-500/20 shadow-sm relative overflow-hidden">
                <div className="absolute -bottom-4 -right-4 opacity-20">
                  <HelpCircle className="size-32" />
                </div>
                {questions.length > 0 ? (
                  <>
                    <h4 className="text-lg font-semibold mb-4">Làm bài trực tuyến</h4>
                    <p className="text-sm mb-6 opacity-90">
                      Trả lời trực tiếp các câu hỏi bên trên thay vì nộp tệp.
                    </p>
                    <ul className="space-y-3 mb-6">
                      <li className="flex items-center gap-2 text-sm">
                        <Timer className="size-4" />
                        <span>{questions.length} câu hỏi</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <HelpCircle className="size-4" />
                        <span>
                          {questions.filter((q) => isMcqQuestion(q)).length} trắc nghiệm,{" "}
                          {questions.filter((q) => !isMcqQuestion(q)).length} tự luận
                        </span>
                      </li>
                    </ul>
                    <Button
                      onClick={handleSubmit}
                      disabled={
                        submitting ||
                        uploading ||
                        questions.every((q) =>
                          isMcqQuestion(q)
                            ? mcqSelections[q.id] == null
                            : !perQuestionAnswers[q.id]?.trim()
                        )
                      }
                      className="w-full py-4 rounded-xl text-base font-bold bg-white/20 hover:bg-white/30 border border-white/30 text-white"
                      variant="ghost"
                    >
                      {submitting ? (
                        <><Loader2 className="size-5 mr-2 animate-spin" /> Đang nộp...</>
                      ) : (
                        <><Send className="size-5 mr-2" /> Nộp bài trực tuyến</>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <h4 className="text-lg font-semibold mb-4">Nộp bài trực tuyến</h4>
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Nhập câu trả lời của bạn..."
                      rows={5}
                      className="mb-4 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      disabled={submitting || uploading}
                    />
                    <Button
                      onClick={handleSubmit}
                      disabled={(!answer.trim() && !selectedFile) || submitting || uploading}
                      className="w-full py-4 rounded-xl text-base font-bold bg-white/20 hover:bg-white/30 border border-white/30 text-white"
                      variant="ghost"
                    >
                      {uploading ? (
                        <><Loader2 className="size-5 mr-2 animate-spin" /> Đang tải lên...</>
                      ) : submitting ? (
                        <><Loader2 className="size-5 mr-2 animate-spin" /> Đang nộp...</>
                      ) : (
                        <><Send className="size-5 mr-2" /> Nộp bài</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Submission — plain text assignments (no questions, no file upload card shown yet, just submit) */}
          {!mySubmission && !mySubmitted && assignment.source !== "weakness" && questions.length === 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Nộp bài</h2>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Nhập câu trả lời của bạn..."
                rows={6}
                className="mb-4"
                disabled={submitting || uploading}
              />
              {/* File upload */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition w-full justify-center"
                >
                  <Upload className="size-4" />
                  {selectedFile ? selectedFile.name : "Tải lên ảnh bài làm (tuỳ chọn)"}
                </button>
                {selectedFile && (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Paperclip className="size-4 text-primary" />
                    <span className="text-gray-600">{selectedFile.name}</span>
                    <button
                      onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-red-500 hover:text-red-700 ml-auto"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {selectedFile && (
                  <div className="mt-2 max-w-xs rounded-xl overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Ảnh bài làm"
                      className="w-full h-auto max-h-48 object-contain bg-gray-50"
                    />
                  </div>
                )}
              </div>
              <Button
                onClick={handleSubmit}
                disabled={(!answer.trim() && !selectedFile) || submitting || uploading}
                size="lg"
                className="w-full rounded-xl font-bold"
              >
                {uploading ? (
                  <><Loader2 className="size-5 mr-2 animate-spin" /> Đang tải lên...</>
                ) : submitting ? (
                  <><Loader2 className="size-5 mr-2 animate-spin" /> Đang nộp...</>
                ) : (
                  <><Send className="size-5 mr-2" /> Nộp bài</>
                )}
              </Button>
            </div>
          )}

          {/* Graded Submission Result */}
          {mySubmission && (
            <div className="space-y-6">
              {/* Score Ring + Stats Bento */}
              {mySubmission.score != null && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Score Ring Card */}
                  <div className="md:col-span-1 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Tổng điểm</p>
                    <div className="relative flex items-center justify-center w-28 h-28 mb-3">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          className="text-gray-100"
                          cx="56" cy="56" r="50"
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="8"
                        />
                        <circle
                          className="text-primary transition-all duration-1000"
                          cx="56" cy="56" r="50"
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 50}`}
                          strokeDashoffset={`${2 * Math.PI * 50 * (1 - mySubmission.score / assignment.maxScore)}`}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-bold text-primary">{mySubmission.score}</span>
                        <span className="text-[11px] text-gray-400">/ {assignment.maxScore}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Xếp loại:{" "}
                      <span className="text-primary font-bold">
                        {mySubmission.score >= assignment.maxScore * 0.8
                          ? "Giỏi"
                          : mySubmission.score >= assignment.maxScore * 0.5
                          ? "Khá"
                          : "Cần cải thiện"}
                      </span>
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Correct answers */}
                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 flex flex-col gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                        <Check className="size-5" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {gradingDetails.filter((d) => d.feedback === "Đúng").length}/{gradingDetails.length || questions.length}
                      </p>
                      <p className="text-sm text-gray-500">Câu trả lời đúng</p>
                    </div>
                    {/* Time info */}
                    <div className="bg-pink-50 rounded-2xl p-5 border border-pink-100 flex flex-col gap-2">
                      <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600">
                        <Clock3 className="size-5" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {mySubmission.submittedAt
                          ? formatDate(mySubmission.submittedAt)
                          : "--"}
                      </p>
                      <p className="text-sm text-gray-500">Ngày nộp bài</p>
                    </div>
                    {/* Status */}
                    <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex flex-col gap-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <Check className="size-5" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {statusLabel[mySubmission.status] || mySubmission.status}
                      </p>
                      <p className="text-sm text-gray-500">
                        {mySubmission.status === "GRADED" ? "Đã chấm xong" : "Đang chờ chấm"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Score display for non-graded (just submitted, no score yet) */}
              {mySubmission.score == null && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    Bài nộp của bạn
                  </h2>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 flex items-center gap-2">
                    <Clock3 className="size-4" />
                    Bài đã được nộp và đang chờ giáo viên chấm điểm.
                  </div>
                </div>
              )}

              {/* Detailed Question Review */}
              {gradingDetails.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900">Đánh giá chi tiết</h3>
                  {gradingDetails.map((detail, i) => {
                    const isCorrect = detail.feedback === "Đúng";
                    const q = questions.find((q) => q.id === detail.questionId);
                    const mcq = q ? isMcqQuestion(q) : false;
                    const options = q
                      ? (q.options && q.options.length > 0 ? q.options : parseInlineMcqOptions(q.question))
                      : [];
                    const studentAnswerIdx = (() => {
                      if (!mySubmission?.content) return -1;
                      try {
                        const parsed = JSON.parse(mySubmission.content);
                        const ans = parsed.answers?.find((a: { questionId: string; answer: string }) => a.questionId === detail.questionId);
                        if (ans?.answer && mcq) {
                          return ans.answer.toUpperCase().charCodeAt(0) - 65;
                        }
                      } catch {}
                      return -1;
                    })();

                    return (
                      <div
                        key={detail.questionId}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md border-l-[6px] ${
                          isCorrect ? "border-l-emerald-500" : "border-l-red-500"
                        }`}
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start gap-4 mb-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold uppercase">
                              Câu {i + 1}
                            </span>
                            <span
                              className={`flex items-center gap-1 font-bold text-sm ${
                                isCorrect ? "text-emerald-600" : "text-red-600"
                              }`}
                            >
                              {isCorrect ? (
                                <><Check className="size-4" /> +{detail.score} Điểm</>
                              ) : (
                                <><X className="size-4" /> +{detail.score} Điểm</>
                              )}
                            </span>
                          </div>

                          <p className="text-base text-gray-900 font-semibold mb-4">
                            <MathText text={detail.question} />
                          </p>

                          {/* MCQ Options review */}
                          {mcq && options.length > 0 && (
                            <div className="space-y-1.5 mb-4">
                              {options.map((opt, idx) => {
                                const isSelected = idx === studentAnswerIdx;
                                const isCorrectOption = opt.isCorrect;
                                let optionStyle = "flex items-center gap-3 p-3 rounded-xl border-2 ";
                                if (isCorrectOption) {
                                  optionStyle += "border-emerald-400 bg-emerald-100";
                                } else if (isSelected && !isCorrect) {
                                  optionStyle += "border-red-400 bg-red-100";
                                } else {
                                  optionStyle += "border-gray-200 bg-gray-50";
                                }
                                return (
                                  <div key={idx} className={optionStyle}>
                                    <span
                                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                        isCorrectOption
                                          ? "bg-emerald-500 text-white"
                                          : isSelected && !isCorrect
                                          ? "bg-red-500 text-white"
                                          : "border border-gray-300 text-gray-500"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                    <span className="text-sm flex-1"><MathText text={opt.text} /></span>
                                    {isCorrectOption && <Check className="size-4 text-emerald-600" />}
                                    {isSelected && !isCorrect && (
                                      <span className="text-xs font-bold text-red-600">Lựa chọn của bạn</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Explanation */}
                          <div className={`p-4 rounded-xl ${isCorrect ? "bg-emerald-100 border border-emerald-300" : "bg-red-100 border border-red-300"}`}>
                            <p className={`text-sm font-bold mb-1 flex items-center gap-1 ${isCorrect ? "text-emerald-800" : "text-red-700"}`}>
                              {isCorrect ? (
                                <><Check className="size-4" /> Giải thích:</>
                              ) : (
                                <><X className="size-4" /> Góp ý:</>
                              )}
                            </p>
                            <p className={`text-sm ${isCorrect ? "text-emerald-800" : "text-red-800"}`}>{detail.feedback}</p>
                            {!isCorrect && detail.correctAnswer && (
                              <p className="text-sm text-emerald-700 font-semibold mt-1">
                                Đáp án đúng: {detail.correctAnswer}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Content (non-question assignments) */}
              {questions.length === 0 && mySubmission.score != null && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    Bài nộp của bạn
                  </h2>
                  <div className="p-4 bg-gray-50 rounded-xl mb-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {assignment.source === "weakness"
                        ? (() => {
                            try {
                              const parsed = JSON.parse(mySubmission.content);
                              return parsed.summary || mySubmission.content;
                            } catch { return mySubmission.content; }
                          })()
                        : mySubmission.content}
                    </p>
                  </div>
                  {mySubmission.fileUrl && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Ảnh bài làm:</p>
                      <a
                        href={mySubmission.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-sm rounded-xl overflow-hidden border hover:opacity-90 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mySubmission.fileUrl}
                          alt="Bài làm"
                          className="w-full h-auto max-h-64 object-contain bg-gray-50"
                        />
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    <Clock3 className="size-3 inline mr-1" />
                    Nộp lúc: {formatDateTime(mySubmission.submittedAt)}
                  </p>
                </div>
              )}

              {/* Questions summary (submitted, no grading details yet) */}
              {gradingDetails.length === 0 && questions.length > 0 && mySubmission.score == null && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Bài nộp của bạn</h2>
                  <div className="space-y-2 mb-4">
                    {questions.map((q, i) => {
                      const ans = (() => {
                        try {
                          const parsed = JSON.parse(mySubmission.content);
                          return parsed.answers?.find(
                            (a: { questionId: string; answer: string }) => a.questionId === q.id
                          )?.answer || "";
                        } catch { return ""; }
                      })();
                      return (
                        <div key={q.id} className="flex items-center gap-2 text-sm p-3 bg-gray-50 rounded-xl">
                          <span className="font-medium text-gray-700 shrink-0">Câu {i + 1}:</span>
                          <span className="text-gray-600 truncate">{ans || "(không trả lời)"}</span>
                        </div>
                      );
                    })}
                  </div>
                  {mySubmission.fileUrl && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2 font-medium">Ảnh bài làm:</p>
                      <a
                        href={mySubmission.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-sm rounded-xl overflow-hidden border hover:opacity-90 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={mySubmission.fileUrl}
                          alt="Bài làm"
                          className="w-full h-auto max-h-64 object-contain bg-gray-50"
                        />
                      </a>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-4">
                    <Clock3 className="size-3 inline mr-1" />
                    Nộp lúc: {formatDateTime(mySubmission.submittedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======== RIGHT SIDEBAR ======== */}
        <div className="lg:w-80 shrink-0 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h4 className="text-lg font-semibold text-gray-900 mb-5">Trạng thái nộp bài</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Tình trạng:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadgeStyle[effectiveStatus] || "bg-gray-100 text-gray-600"}`}>
                  {statusLabel[effectiveStatus] || effectiveStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Ngày nộp:</span>
                <span className="text-sm text-gray-900">
                  {mySubmission ? formatDate(mySubmission.submittedAt) : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Điểm số:</span>
                <span className="text-sm text-gray-900 font-bold">
                  {mySubmission?.score != null ? `${mySubmission.score} / ${assignment.maxScore}` : `-- / ${assignment.maxScore}`}
                </span>
              </div>
            </div>
            {!mySubmission && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <p className="text-xs text-gray-400 italic">
                  {overdue
                    ? "Bài tập đã quá hạn. Bạn vẫn có thể nộp bài muộn."
                    : "Hãy nộp bài trước hạn chót để được chấm điểm đầy đủ."}
                </p>
              </div>
            )}
            {mySubmission && mySubmission.score != null && (
              <div className="mt-5 pt-5 border-t border-gray-200">
                <p className="text-xs text-gray-400 italic">
                  Bài đã được chấm xong. Xem chi tiết đánh giá bên dưới.
                </p>
              </div>
            )}
          </div>

          {/* Teacher Feedback Card (when feedback exists) */}
          {mySubmission?.feedback && mySubmission.score != null && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-primary p-5 text-white">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <MessageCircle className="size-5" />
                  Phản hồi từ Giáo viên
                </h4>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary">
                    <User className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{assignment.creatorName || "Giáo viên"}</p>
                    <p className="text-xs text-gray-500">Giáo viên hướng dẫn</p>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl italic text-sm text-gray-700 relative">
                  <span className="absolute -top-2 -left-2 text-primary/10 text-3xl select-none">&ldquo;</span>
                  {(() => {
                    const fb = mySubmission.feedback || "";
                    const bracketIdx = fb.indexOf("[");
                    if (bracketIdx === -1) return fb;
                    const global = fb.substring(0, bracketIdx).trim();
                    return global || "Xem đánh giá chi tiết từng câu bên dưới.";
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Question Navigation Grid (when graded and has questions) */}
          {questions.length > 0 && mySubmission && (
            <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
              <h4 className="text-sm font-bold text-gray-900 mb-4">Danh sách câu hỏi</h4>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const gradeResult = gradingDetails.find((g) => g.questionId === q.id);
                  const isCorrect = gradeResult?.feedback === "Đúng";
                  const hasResult = gradeResult != null;
                  return (
                    <button
                      key={q.id}
                      onClick={() => scrollToQuestion(i)}
                      className={`aspect-square flex items-center justify-center rounded-lg font-bold text-xs transition-all hover:scale-105 ${
                        hasResult
                          ? isCorrect
                            ? "bg-emerald-500 text-white"
                            : "bg-secondary text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              {gradingDetails.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Đúng ({gradingDetails.filter((d) => d.feedback === "Đúng").length})
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" /> Sai ({gradingDetails.filter((d) => d.feedback !== "Đúng").length})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Teacher Card (when not yet submitted) */}
          {!mySubmission && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Giáo viên</h4>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-primary">
                  <User className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{assignment.creatorName || "Giáo viên"}</p>
                </div>
              </div>
              <Link
                href="/messages"
                className="w-full flex items-center justify-center gap-2 py-3 border border-primary text-primary rounded-xl hover:bg-primary/5 transition-colors text-sm font-medium"
              >
                <MessageCircle className="size-4" />
                Đặt câu hỏi
              </Link>
            </div>
          )}

          {/* CTA: Support (when submitted) */}
          {mySubmission && (
            <div className="bg-blue-50 rounded-2xl p-5 flex items-center gap-4 border border-blue-100">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                <MessageCircle className="size-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Cần hỗ trợ?</p>
                <Link href="/messages" className="text-sm text-primary hover:underline font-medium">
                  Liên hệ Giáo viên
                </Link>
              </div>
            </div>
          )}

          {/* Motivational Card (when not submitted) */}
          {!mySubmission && (
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 flex flex-col items-center text-center">
              <div className="w-24 h-24 mb-4 bg-white rounded-full p-3 shadow-inner flex items-center justify-center">
                <Send className="size-10 text-primary/70" />
              </div>
              <p className="text-sm text-gray-600 italic leading-relaxed">
                &ldquo;Hãy bắt đầu sớm để có thời gian kiểm tra lại kết quả bài làm của bạn!&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
