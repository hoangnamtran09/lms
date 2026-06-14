"use client";

import { useEffect, useState, use, useRef } from "react";
import Image from "next/image";
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
  Download,
  Eye,
  ArrowLeft,
  GraduationCap,
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
import type { Assignment, Question, Submission, QuestionResult, McqOption } from "./_types";
import { difficultyLabels, difficultyColors, statusLabel, statusColor as statusBadgeStyle } from "./_types";

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

function isImageFile(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
}

function fileNameFromUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/");
    return parts[parts.length - 1] || "Tài liệu";
  } catch {
    return "Tài liệu";
  }
}

function extractTeacherFeedback(feedback: string): string {
  const bracketIdx = feedback.indexOf("[");
  if (bracketIdx === 0) return "";
  const text = bracketIdx > 0 ? feedback.substring(0, bracketIdx).trim() : feedback.trim();
  return text.replace(/^Tổng điểm:.*?\n/, "").trim();
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

  useEffect(() => { loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        queueMicrotask(() => {
          setMcqSelections(selections);
          setPerQuestionAnswers(texts);
          setMySubmitted(true);
        });
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
      setSubmitResults(res.results);
      setSubmitted(true);
      setMySubmitted(true);
      setAnswer("");
      setSelectedFile(null);
      // Reload from API to ensure mySubmission is found
      loadData();
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
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8">
        <Skeleton delay={0} className="h-6 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <Skeleton delay={80} className="h-48 rounded-2xl" />
            <Skeleton delay={160} className="h-64 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <Skeleton delay={240} className="h-40 rounded-2xl" />
            <Skeleton delay={320} className="h-48 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-20 text-center">
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
  const hasDueDate = assignment.dueDate && new Date(assignment.dueDate).getFullYear() > 1;
  const isGraded = !!mySubmission || !!submitResults;
  const canSubmit = !mySubmission && !mySubmitted && assignment.source !== "weakness";

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <Link href="/assignments" className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline">
            <ArrowLeft className="size-4" />
            Quay lại danh sách bài tập
          </Link>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">{assignment.title}</h1>
          <div className="flex flex-wrap items-center gap-4">
            {assignment.creatorName && (
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <GraduationCap className="size-4" />
                <span>{assignment.creatorName}</span>
              </div>
            )}
            {hasDueDate && (
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Calendar className="size-4" />
                <span>Hạn nộp: {new Date(assignment.dueDate).toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasDueDate && (
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${overdue ? "bg-red-100 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {overdue ? "Quá hạn" : "Đang diễn ra"}
            </span>
          )}
          <span className="text-gray-400 text-sm">Mã: {assignment.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* ── Two-Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ===== LEFT COLUMN (8 cols) ===== */}
        <div className="lg:col-span-8 space-y-8">
          {/* ── Instructions & Materials ── */}
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="size-5" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Hướng dẫn & Tài liệu</h3>
            </div>

            {/* Weakness exercises */}
            {weaknessExercises.length > 0 ? (
              <div className="space-y-3">
                {allExercisesCorrect && (
                  <div className="p-3 bg-green-50 rounded-xl text-sm text-green-700 flex items-center gap-2">
                    <Check className="size-4" /> Bạn đã hoàn thành tất cả bài tập — điểm yếu này đã được xoá.
                  </div>
                )}
                {!allExercisesCorrect && mySubmission && (
                  <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700 flex items-center gap-2">
                    <FileText className="size-4" /> Bạn đã nộp bài. Các câu trả lời trước đây được hiển thị bên dưới.
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
            ) : (
              <>
                {/* Description text */}
                {assignment.description ? (
                  <p className="text-gray-600 text-base leading-relaxed mb-6 whitespace-pre-wrap">{assignment.description}</p>
                ) : (
                  <p className="text-gray-400 italic mb-6">Không có mô tả cho bài tập này</p>
                )}

                {/* Rubric */}
                {assignment.rubric && (
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 text-sm text-gray-700 mb-6">
                    <span className="font-semibold">Tiêu chí chấm:</span> {assignment.rubric}
                  </div>
                )}

                {/* Attachments */}
                {assignment.attachmentUrl && (
                  <div className="border-t border-gray-100 pt-6">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Tài liệu đính kèm</h4>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer group"
                      onClick={() => window.open(assignment.attachmentUrl, "_blank")}
                    >
                      <div className="flex items-center gap-3">
                        {isImageFile(assignment.attachmentUrl!) ? (
                          <Eye className="size-8 text-blue-500" />
                        ) : (
                          <FileText className="size-8 text-red-500" />
                        )}
                        <div>
                          <p className="font-semibold text-sm text-gray-900 truncate max-w-[200px]">{fileNameFromUrl(assignment.attachmentUrl!)}</p>
                          <p className="text-xs text-gray-400">{isImageFile(assignment.attachmentUrl!) ? "Nhấn để xem" : "Nhấn để tải xuống"}</p>
                        </div>
                      </div>
                      {isImageFile(assignment.attachmentUrl!) ? (
                        <Eye className="size-5 text-gray-300 group-hover:text-blue-500" />
                      ) : (
                        <Download className="size-5 text-gray-300 group-hover:text-blue-500" />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── Questions Section (pre-submission) ── */}
          {questions.length > 0 && weaknessExercises.length === 0 && (
            <div className="space-y-6 max-h-[800px] overflow-y-auto pr-2" id="questions-container">
              <h3 className="text-lg font-bold text-gray-900 px-2">Câu hỏi trực tuyến</h3>
              {questions.map((q, i) => {
                const mcq = isMcqQuestion(q);
                const selection = mcqSelections[q.id];
                const shortAnswer = perQuestionAnswers[q.id] || "";
                const allResults = submitResults && submitResults.length > 0 ? submitResults : gradingDetails;
                const resultMap = new Map<string, QuestionResult>();
                allResults.forEach((r) => resultMap.set(r.questionId, r));
                const gradeResult = resultMap.get(q.id);

                return (
                  <div key={q.id} id={`question-${i}`} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 scroll-mt-24">
                    <div className="flex items-start gap-4 mb-6">
                      <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{(i + 1)}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900"><MathText text={q.question} /></p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {q.difficulty && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                              {difficultyLabels[q.difficulty] || q.difficulty}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">({q.score || 10}đ)</span>
                          {gradeResult && (
                            <Badge variant={gradeResult.feedback === "Đúng" ? "default" : "outline"} className="text-xs">
                              {gradeResult.feedback === "Đúng" ? "Đúng" : "Sai"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ml-12">
                      {mcq ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(q.options && q.options.length > 0 ? q.options : parseInlineMcqOptions(q.question)).map((opt, idx) => {
                            const letter = String.fromCharCode(65 + idx);
                            let cardStyle = "flex items-center gap-3 p-4 rounded-2xl border transition-all ";
                            if (!isGraded) {
                              cardStyle += selection === idx
                                ? "border-primary bg-primary/5 text-primary cursor-pointer"
                                : "border-gray-200 hover:border-primary/50 cursor-pointer";
                            } else {
                              const isSelected = selection === idx;
                              const isCorrect = gradeResult?.feedback === "Đúng";
                              if (isSelected && isCorrect) cardStyle += "border-green-300 bg-green-50 text-green-800";
                              else if (isSelected && !isCorrect) cardStyle += "border-red-300 bg-red-50 text-red-800";
                              else cardStyle += "border-gray-100 bg-white text-gray-400";
                            }
                            return (
                              <label key={idx} className={cardStyle}>
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={selection === idx}
                                  onChange={() => { if (!isGraded) setMcqSelections((prev) => ({ ...prev, [q.id]: idx })); }}
                                  disabled={isGraded}
                                  className="w-5 h-5 text-primary border-gray-300 focus:ring-primary"
                                />
                                <span className="font-medium text-sm">{letter}. <MathText text={opt.text} /></span>
                                {isGraded && selection === idx && (
                                  gradeResult?.feedback === "Đúng" ? <Check className="size-4 text-green-600 ml-auto" /> : <X className="size-4 text-red-600 ml-auto" />
                                )}
                              </label>
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
                                const ans = parsed.answers?.find((a: { questionId: string; answer: string }) => a.questionId === q.id);
                                return ans?.answer || "";
                              } catch { return ""; }
                            }
                            return shortAnswer;
                          })()}
                          onChange={(e) => setPerQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Nhập câu trả lời của bạn tại đây..."
                          rows={4}
                          disabled={isGraded}
                          className="bg-gray-50 border-gray-200 rounded-2xl"
                        />
                      )}

                      {/* Result + explanation */}
                      {isGraded && (
                        <div className={`mt-4 p-4 rounded-2xl text-sm ${gradeResult ? (gradeResult.feedback === "Đúng" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200") : "bg-blue-50 border border-blue-200"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {gradeResult ? (
                              gradeResult.feedback === "Đúng"
                                ? <><Check className="size-4 text-green-600" /><span className="font-medium text-green-700">Đúng</span></>
                                : <><X className="size-4 text-red-600" /><span className="font-medium text-red-700">Sai</span></>
                            ) : (
                              <><FileText className="size-4 text-blue-600" /><span className="font-medium text-blue-700">Đã nộp</span></>
                            )}
                          </div>
                          {mcq && gradeResult && gradeResult.feedback !== "Đúng" && gradeResult.correctAnswer && (
                            <p className="text-xs text-gray-600 mb-1">Đáp án đúng: <span className="font-medium">{gradeResult.correctAnswer}</span></p>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-gray-600"><span className="font-medium">Giải thích:</span> <MathText text={q.explanation} /></p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Graded Submission Result ── */}
          {mySubmission && (
            <div className="space-y-8">
              {/* ── Nội dung bài làm ── */}
              {mySubmission.content && (
                <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><FileText className="size-5" /></div>
                    <h3 className="text-2xl font-semibold text-gray-900">Nội dung bài làm</h3>
                  </div>
                  <div className="space-y-4">
                    {gradingDetails.length > 0 ? (
                      gradingDetails.map((detail, i) => {
                        const q = questions.find((q) => q.id === detail.questionId);
                        const mcq = q ? isMcqQuestion(q) : false;
                        const studentAns = (() => {
                          if (!mySubmission?.content) return "";
                          try { const p = JSON.parse(mySubmission.content); const a = p.answers?.find((a: {questionId:string; answer:string}) => a.questionId === detail.questionId); return a?.answer || ""; } catch { return ""; }
                        })();
                        const isCorrect = detail.feedback === "Đúng";
                        return (
                          <div key={detail.questionId} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Câu hỏi {i+1}: {mcq ? "Trắc nghiệm" : "Tự luận"}</p>
                            {mcq ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">Đáp án chọn:</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{studentAns}</span>
                                {isCorrect && <span className="text-emerald-600 italic text-sm">(Chính xác)</span>}
                              </div>
                            ) : (
                              <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">{studentAns || <span className="text-gray-400 italic">Chưa trả lời</span>}</p>
                            )}
                          </div>
                        );
                      })
                    ) : (() => {
                      // Parse answers from content for display without grading details
                      const parsedAnswers: { questionId: string; answer: string }[] = (() => {
                        try { const p = JSON.parse(mySubmission.content); return p.answers || []; } catch { return []; }
                      })();
                      return parsedAnswers.length > 0 ? (
                        parsedAnswers.map((ans, i) => {
                          const q = questions.find((q) => q.id === ans.questionId);
                          const mcq = q ? isMcqQuestion(q) : false;
                          return (
                            <div key={ans.questionId} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                              <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Câu hỏi {i+1}: {mcq ? "Trắc nghiệm" : "Tự luận"}</p>
                              {mcq ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-700">Đáp án chọn:</span>
                                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">{ans.answer}</span>
                                </div>
                              ) : (
                                <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">{ans.answer || <span className="text-gray-400 italic">Chưa trả lời</span>}</p>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">{mySubmission.content}</div>
                      );
                    })()}
                  </div>
                  {mySubmission.fileUrl && (
                    <div className="mt-8 border-t border-gray-200 pt-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Tài liệu đính kèm</h4>
                      <a href={mySubmission.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group border border-transparent hover:border-blue-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-pink-100 rounded flex items-center justify-center text-pink-600"><FileText className="size-5" /></div>
                          <div>
                            <p className="font-medium text-sm text-gray-900">{fileNameFromUrl(mySubmission.fileUrl)}</p>
                            <p className="text-xs text-gray-400">Nhấn để tải xuống</p>
                          </div>
                        </div>
                        <Download className="size-4 text-gray-300 group-hover:text-blue-500" />
                      </a>
                    </div>
                  )}
                </section>
              )}

            </div>
          )}
        </div>

        {/* ===== RIGHT COLUMN (4 cols) ===== */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            {/* ── Grade Card (when scored) ── */}
            {mySubmission && mySubmission.score != null && (
              <>
                <div className="bg-primary rounded-2xl text-white shadow-xl relative overflow-hidden text-center p-2">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary to-blue-700 opacity-50" />
                  <div className="relative z-10 py-4 px-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-200 mb-4">Kết quả cuối cùng</p>
                    <div className="relative inline-flex items-center justify-center mb-4">
                      <svg className="w-32 h-32 -rotate-90">
                        <circle className="text-white/10" cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="6" />
                        <circle className="text-emerald-400 transition-all duration-1000" cx="64" cy="64" r="56" fill="transparent" stroke="currentColor"
                          strokeWidth="6" strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - Math.min(mySubmission.score / assignment.maxScore, 1))}`}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-4xl font-extrabold">{mySubmission.score}</span>
                        <span className="text-xs font-medium opacity-80">trên {assignment.maxScore}</span>
                      </div>
                    </div>
                    <h4 className="text-lg font-bold mb-1">
                      {mySubmission.score >= assignment.maxScore * 0.9 ? "Xuất sắc!" : mySubmission.score >= assignment.maxScore * 0.8 ? "Giỏi!" : mySubmission.score >= assignment.maxScore * 0.5 ? "Khá!" : "Cần cải thiện"}
                    </h4>
                    <p className="text-xs text-blue-200 mb-4">
                      {mySubmission.score >= assignment.maxScore * 0.8 ? "Bạn nằm trong top đầu của lớp" : "Hãy cố gắng hơn ở lần sau nhé!"}
                    </p>
                    <button className="w-full py-2 bg-white text-primary font-bold rounded-lg shadow-md hover:bg-blue-50 transition-all text-sm">
                      Xem bảng xếp hạng
                    </button>
                  </div>
                </div>

                {/* Stats Card */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                  <h4 className="font-bold text-gray-900 mb-4">Chi tiết điểm số</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Đúng hạn</span>
                      <span className="text-emerald-600">{hasDueDate && !overdue ? "✓" : "—"}</span>
                    </div>
                    {gradingDetails.length > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Độ chính xác</span>
                        <span className="font-bold text-gray-900 text-sm">{Math.round((gradingDetails.filter(d => d.feedback === "Đúng").length / gradingDetails.length) * 100)}%</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">Ngày nộp</span>
                      <span className="font-bold text-gray-900 text-sm">{mySubmission.submittedAt ? formatDate(mySubmission.submittedAt) : "--"}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Status Card (pre-submission) ── */}
            {!mySubmission && (
              <div className="bg-primary text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-sm opacity-80 mb-1">Tiến độ bài làm</p>
                      {questions.length > 0 ? (
                        <p className="text-3xl font-bold">{answeredCount}/{questions.length} câu</p>
                      ) : (
                        <p className="text-3xl font-bold">{assignment.maxScore}đ</p>
                      )}
                    </div>
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                      <Timer className="size-7" />
                    </div>
                  </div>

                  {questions.length > 0 && (
                    <>
                      <div className="flex justify-between items-end mb-1">
                        <span className="text-sm font-semibold opacity-80">Hoàn thành</span>
                        <span className="text-sm font-bold">{questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden mb-6">
                        <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0}%` }} />
                      </div>
                    </>
                  )}

                  {hasDueDate && (
                    <div className="mb-6 flex items-center gap-2 text-sm opacity-80">
                      <Calendar className="size-4" />
                      <span>{overdue ? "Đã quá hạn nộp" : `Còn hạn đến ${formatDate(assignment.dueDate)}`}</span>
                    </div>
                  )}

                  {canSubmit && (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      {selectedFile ? (
                        <div className="mb-3 flex items-center gap-2 p-2.5 bg-white/10 rounded-xl text-sm">
                          <Paperclip className="size-4 shrink-0" />
                          <span className="truncate flex-1 opacity-90">{selectedFile.name}</span>
                          <button onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="hover:text-red-200 shrink-0"><X className="size-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => fileInputRef.current?.click()} className="mb-3 w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition-colors">
                          <Upload className="size-4" /> Đính kèm file
                        </button>
                      )}
                      <Button onClick={handleSubmit}
                        disabled={submitting || uploading || (questions.length > 0 && answeredCount === 0 && !selectedFile) || (questions.length === 0 && !answer.trim() && !selectedFile)}
                        className="w-full bg-white text-primary font-extrabold py-6 rounded-2xl shadow-md hover:bg-blue-50 transition-all" size="lg"
                      >
                        {uploading ? <><Loader2 className="size-5 mr-2 animate-spin" /> Đang tải lên...</> : submitting ? <><Loader2 className="size-5 mr-2 animate-spin" /> Đang nộp...</> : <><Send className="size-5 mr-2" /> Nộp bài</>}
                      </Button>
                      <p className="text-xs text-center opacity-70 italic mt-2">Nhấn nộp bài để kết thúc phiên làm việc</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Pending review card ── */}
            {mySubmission && mySubmission.score == null && (
              <div className="bg-blue-50/70 rounded-2xl border border-blue-100 shadow-sm p-8 text-center relative overflow-hidden">
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock3 className="size-8 text-pink-700" />
                  </div>
                  <h4 className="text-2xl font-semibold text-gray-900 mb-2">Đang chờ chấm bài</h4>
                  <p className="text-sm text-gray-600 mb-6">Giáo viên đang xem xét bài làm của bạn. Kết quả sẽ sớm được cập nhật.</p>
                  <div className="flex items-center justify-center gap-2 text-pink-600 font-medium text-sm">
                    <Clock3 className="size-4" />
                    <span>Dự kiến: Trong 24h tới</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Phản hồi từ giáo viên (right sidebar) ── */}
            {mySubmission && (
              (() => {
                const feedbackText = mySubmission.feedback ? extractTeacherFeedback(mySubmission.feedback) : "";
                return feedbackText ? (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600"><MessageCircle className="size-4" /></div>
                      <h4 className="font-bold text-gray-900 text-sm">Phản hồi từ giáo viên</h4>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-primary shrink-0"><User className="size-4" /></div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{assignment.creatorName || "Giáo viên"}</p>
                        <p className="text-xs text-gray-400">{mySubmission.gradedAt ? formatDate(mySubmission.gradedAt) : ""}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed italic bg-gray-50 p-3 rounded-xl border-l-4 border-emerald-500">
                      "{feedbackText}"
                    </p>
                  </div>
                ) : mySubmission.score != null ? (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-gray-100 rounded-lg text-gray-400"><MessageCircle className="size-4" /></div>
                      <h4 className="font-bold text-gray-900 text-sm">Phản hồi từ giáo viên</h4>
                    </div>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <MessageCircle className="size-8 text-gray-300" />
                      </div>
                      <p className="font-semibold text-gray-700 text-sm mb-1">Chưa có nhận xét</p>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">Vui lòng quay lại sau khi giáo viên đã hoàn thành việc chấm bài.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 bg-gray-100 rounded-lg text-gray-400"><MessageCircle className="size-4" /></div>
                      <h4 className="font-bold text-gray-900 text-sm">Phản hồi từ giáo viên</h4>
                    </div>
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <MessageCircle className="size-8 text-gray-300" />
                      </div>
                      <p className="font-semibold text-gray-700 text-sm mb-1">Chưa có nhận xét</p>
                      <p className="text-xs text-gray-400 max-w-xs mx-auto">Vui lòng quay lại sau khi giáo viên đã hoàn thành việc chấm bài.</p>
                    </div>
                  </div>
                );
              })()
            )}

            {/* ── Question Navigation Grid ── */}
            {questions.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-bold text-gray-900 mb-4">Danh sách câu hỏi</h4>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, i) => {
                    const answered = isQuestionAnswered(q);
                    return (
                      <button key={q.id} onClick={() => scrollToQuestion(i)} title={`Câu ${i + 1}${answered ? " (đã làm)" : ""}`}
                        className={`aspect-square rounded-lg flex items-center justify-center font-bold text-xs transition-all hover:scale-105 ${answered ? "bg-primary text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                      >{i + 1}</button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
