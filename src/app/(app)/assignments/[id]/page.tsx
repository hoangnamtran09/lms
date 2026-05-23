"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Send, FileText, Check, X, Upload, Loader2 } from "lucide-react";
import { api, uploadFile } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";
import { RemediationExercise } from "@/components/ai/remediation-exercise";
import type { RemediationQuestion, ExerciseAnswer } from "@/components/ai/remediation-exercise";
import { MathText } from "@/components/ai/math-text";

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

const statusLabel: Record<string, string> = {
  ASSIGNED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

const backLink = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4";

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

  // Parse weakness exercises from description (JSON array)
  const weaknessExercises: RemediationQuestion[] = (() => {
    if (assignment?.source !== "weakness" || !assignment?.description) return [];
    try {
      const parsed = JSON.parse(assignment.description);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Restore previous answers from submission content
  const previousAnswers: (ExerciseAnswer | null)[] = (() => {
    if (!mySubmission?.content) return [];
    try {
      const parsed = JSON.parse(mySubmission.content);
      return Array.isArray(parsed.answers) ? parsed.answers : [];
    } catch {
      return [];
    }
  })();

  // Parse questions from assignment
  const questions: Question[] = (() => {
    if (!assignment?.questions) return [];
    try {
      const parsed = JSON.parse(assignment.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  // Parse grading details from submission feedback (handles text prefix + JSON)
  const gradingDetails: QuestionResult[] = (() => {
    if (!mySubmission?.feedback) return [];
    try {
      const parsed = JSON.parse(mySubmission.feedback);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    // Find JSON array in text (e.g. "Tổng điểm: 4/10\n[{...}]")
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

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { loadData(); }, [id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/set-state-in-effect */
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
            if (idx >= 0 && idx < 4) {
              selections[q.id] = idx;
            }
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
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (mySubmission || mySubmitted || submitting) return;
    const hasQuestions = questions.length > 0;
    if (!hasQuestions && !answer.trim() && !selectedFile) return;
    if (hasQuestions) {
      const anyMcqAnswered = questions.some((q) => isMcqQuestion(q) && mcqSelections[q.id] != null);
      const anyShortAnswered = questions.some((q) => !isMcqQuestion(q) && perQuestionAnswers[q.id]?.trim());
      if (!anyMcqAnswered && !anyShortAnswered && !selectedFile) return;
    }
    setSubmitting(true);

    // Upload file if selected
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={120} className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{error || "Không tìm thấy bài tập"}</p>
        <Link href="/assignments" className="text-sm text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/assignments" className={backLink}>
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      {/* Assignment header */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
              <Badge>
                {mySubmission
                  ? statusLabel[mySubmission.status] || mySubmission.status
                  : mySubmitted
                  ? "Đã nộp"
                  : statusLabel[assignment.status] || assignment.status}
              </Badge>
            </div>
            {weaknessExercises.length > 0 ? (
              <div className="mt-3 space-y-3">
                {allExercisesCorrect && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
                    <Check className="size-4" />
                    Bạn đã hoàn thành tất cả bài tập — điểm yếu này đã được xoá.
                  </div>
                )}
                {!allExercisesCorrect && mySubmission && (
                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2">
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
              <div className="mt-3 space-y-3">
                {(() => {
                  // Merge grading details from submission feedback and submit response
                  const allResults = submitResults && submitResults.length > 0 ? submitResults : gradingDetails;
                  const resultMap = new Map<string, QuestionResult>();
                  allResults.forEach((r) => resultMap.set(r.questionId, r));
                  const hasResults = resultMap.size > 0;
                  const isGraded = hasResults || !!mySubmission;

                  return questions.map((q, i) => {
                    const mcq = isMcqQuestion(q);
                    const selection = mcqSelections[q.id];
                    const shortAnswer = perQuestionAnswers[q.id] || "";
                    const gradeResult = resultMap.get(q.id);
                    return (
                    <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-sm font-bold text-purple-600 shrink-0 mt-0.5">Câu {i + 1}</span>
                        <span className="text-xs text-gray-400">({q.score || 10}đ)</span>
                        {q.difficulty && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                            {difficultyLabels[q.difficulty] || q.difficulty}
                          </span>
                        )}
                        {gradeResult && (
                          <Badge variant={gradeResult.feedback === "Đúng" ? "default" : "outline"} className="text-xs">
                            {gradeResult.feedback === "Đúng" ? "Đúng" : "Sai"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap mb-3"><MathText text={q.question} /></p>
                      {mcq ? (
                        <div className="space-y-1.5">
                          {(q.options && q.options.length > 0
                            ? q.options
                            : parseInlineMcqOptions(q.question)
                          ).map((opt, idx) => {
                            const letter = String.fromCharCode(65 + idx);
                            let btnStyle = "w-full text-left px-3 py-2 rounded-lg text-sm transition border flex items-center gap-2 ";
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
                                  if (!isGraded) {
                                    setMcqSelections((prev) => ({ ...prev, [q.id]: idx }));
                                  }
                                }}
                                disabled={isGraded}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium">
                                  {letter}
                                </span>
                                <span className="flex-1"><MathText text={opt.text} /></span>
                                {isGraded && selection === idx && (
                                  gradeResult?.feedback === "Đúng"
                                    ? <Check className="size-4 text-green-600 shrink-0" />
                                    : <X className="size-4 text-red-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div>
                          <Textarea
                            value={(() => {
                              const content = mySubmission?.content || (() => {
                                try { return sessionStorage.getItem(`submitted-${id}-content`); } catch { return null; }
                              })();
                              if (content) {
                                try {
                                  const parsed = JSON.parse(content);
              const ans = parsed.answers?.find((a: { questionId: string; answer: string }) => a.questionId === q.id);
              return ans?.answer || "";
                                } catch { return ""; }
                              }
                              return shortAnswer;
                            })()}
                            onChange={(e) =>
                              setPerQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder="Nhập câu trả lời của bạn..."
                            rows={3}
                            disabled={isGraded}
                          />
                        </div>
                      )}
                      {/* Show result and explanation after submission */}
                      {isGraded && (
                        <div className={`mt-3 p-3 rounded-lg text-sm ${gradeResult ? (gradeResult.feedback === "Đúng" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200") : "bg-blue-50 border border-blue-200"}`}>
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
                              <span className="font-medium">Giải thích:</span>{" "}
                              <MathText text={q.explanation} />
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )});
                })()}
              </div>
            ) : (
              <p className="text-gray-600 whitespace-pre-wrap">{assignment.description || "Không có mô tả"}</p>
            )}
          </div>
          <div className="text-right text-sm text-gray-500 shrink-0 ml-4">
            <p>Điểm tối đa: <span className="font-semibold">{assignment.maxScore}</span></p>
            {assignment.dueDate && (
              <p>Hạn: {new Date(assignment.dueDate).toLocaleDateString("vi-VN")}</p>
            )}
            {assignment.creatorName && <p>Giáo viên: {assignment.creatorName}</p>}
          </div>
        </div>
        {assignment.rubric && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-gray-700">
            <span className="font-medium">Tiêu chí chấm:</span> {assignment.rubric}
          </div>
        )}
      </div>

      {/* Student: submit button (skip for weakness — exercises auto-submit) */}
      {!mySubmission && !mySubmitted && assignment.source !== "weakness" && questions.length > 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Nộp bài</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Kiểm tra lại câu trả lời trước khi nộp
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                uploading ||
                (questions.every((q) =>
                  isMcqQuestion(q)
                    ? mcqSelections[q.id] == null
                    : !perQuestionAnswers[q.id]?.trim()
                ) && !selectedFile)
              }
            >
              {uploading ? "Đang tải ảnh..." : submitting ? "Đang nộp..." : "Nộp bài"}
              {uploading ? <Loader2 className="size-4 ml-2 animate-spin" /> : <Send className="size-4 ml-2" />}
            </Button>
          </div>

          {/* File upload */}
          <div className="mt-4">
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
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition"
            >
              <Upload className="size-4" />
              {selectedFile ? selectedFile.name : "Tải lên ảnh bài làm (tuỳ chọn)"}
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="ml-2 text-xs text-red-500 hover:text-red-700"
              >
                Xoá
              </button>
            )}
            {selectedFile && (
              <div className="mt-2 max-w-xs rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="w-full h-auto max-h-48 object-contain bg-gray-50"
                />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Student: submit for plain text assignments */}
      {!mySubmission && !mySubmitted && assignment.source !== "weakness" && questions.length === 0 && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Nộp bài</h2>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Nhập câu trả lời của bạn..."
            rows={6}
            className="mb-3"
            disabled={submitting || uploading}
          />
          {/* File upload */}
          <div className="mb-3">
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
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-gray-400 transition"
            >
              <Upload className="size-4" />
              {selectedFile ? selectedFile.name : "Tải lên ảnh bài làm (tuỳ chọn)"}
            </button>
            {selectedFile && (
              <button
                type="button"
                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                className="ml-2 text-xs text-red-500 hover:text-red-700"
              >
                Xoá
              </button>
            )}
            {selectedFile && (
              <div className="mt-2 max-w-xs rounded-lg overflow-hidden border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="w-full h-auto max-h-48 object-contain bg-gray-50"
                />
              </div>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={(!answer.trim() && !selectedFile) || submitting || uploading}>
            {uploading ? "Đang tải ảnh..." : submitting ? "Đang nộp..." : "Nộp bài"}
            {uploading ? <Loader2 className="size-4 ml-2 animate-spin" /> : <Send className="size-4 ml-2" />}
          </Button>
        </div>
      )}

      {/* Student: my graded submission */}
      {mySubmission && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Bài nộp của bạn</h2>

          {/* Per-question grading details */}
          {gradingDetails.length > 0 ? (
            <div className="space-y-3 mb-4">
              {gradingDetails.map((detail, i) => (
                <div key={detail.questionId} className="p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-800">
                      Câu {i + 1} — {detail.question}
                    </p>
                    <Badge variant={detail.score >= detail.maxScore * 0.5 ? "default" : "outline"}>
                      {detail.score}/{detail.maxScore}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">{detail.feedback}</p>
                    {detail.feedback !== "Đúng" && detail.correctAnswer && (
                      <span className="text-xs text-green-600 font-medium">
                        Đáp án: {detail.correctAnswer}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : questions.length > 0 ? (
            <div className="space-y-2 mb-4">
              {questions.map((q, i) => {
                const ans = (() => {
                  try {
                    const parsed = JSON.parse(mySubmission.content);
                    return parsed.answers?.find((a: { questionId: string; answer: string }) => a.questionId === q.id)?.answer || "";
                  } catch { return ""; }
                })();
                const grade = gradingDetails.find((g) => g.questionId === q.id) || submitResults?.find((r) => r.questionId === q.id);
                return (
                  <div key={q.id} className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">Câu {i + 1}:</span>
                    <span className="text-gray-600">{ans || "(không trả lời)"}</span>
                    {grade && (
                      grade.feedback === "Đúng"
                        ? <Check className="size-3.5 text-green-600" />
                        : <X className="size-3.5 text-red-500" />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg mb-3">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {(() => {
                  if (assignment.source === "weakness") {
                    try {
                      const parsed = JSON.parse(mySubmission.content);
                      return parsed.summary || mySubmission.content;
                    } catch { return mySubmission.content; }
                  }
                  return mySubmission.content;
                })()}
              </p>
            </div>
          )}
          {mySubmission.fileUrl && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1 font-medium">Ảnh bài làm:</p>
              <a
                href={mySubmission.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block max-w-sm rounded-lg overflow-hidden border hover:opacity-90 transition"
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
          {mySubmission.score != null && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-green-800">Điểm: {mySubmission.score}/{assignment.maxScore}</span>
                {mySubmission.score >= assignment.maxScore * 0.5 ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <X className="size-4 text-red-600" />
                )}
              </div>
              {!gradingDetails.length && mySubmission.feedback && (
                <p className="text-sm text-green-700 whitespace-pre-wrap">{mySubmission.feedback}</p>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Nộp lúc: {new Date(mySubmission.submittedAt).toLocaleString("vi-VN")}
          </p>
        </div>
      )}

    </div>
  );
}
