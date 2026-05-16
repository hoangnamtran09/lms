"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles, RefreshCw, FileText, Check, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { RemediationExercise } from "@/components/ai/remediation-exercise";
import type { RemediationQuestion, ExerciseAnswer } from "@/components/ai/remediation-exercise";

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

interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  score: number;
}

interface QuestionResult {
  questionId: string;
  question: string;
  score: number;
  maxScore: number;
  feedback: string;
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

function SubmissionContent({ content, questions }: { content: string; questions: Question[] }) {
  // Try to parse as per-question answers JSON
  try {
    const parsed = JSON.parse(content);
    if (parsed.answers && Array.isArray(parsed.answers)) {
      const answerMap = new Map(parsed.answers.map((a: { questionId: string; answer: string }) => [a.questionId, a.answer]));
      return (
        <div className="space-y-2 mb-2">
          {questions.map((q, i) => (
            <div key={q.id} className="text-sm">
              <span className="font-medium text-gray-700">Câu {i + 1}:</span>{" "}
              <span className="text-gray-600">{String(answerMap.get(q.id) || "(không trả lời)")}</span>
            </div>
          ))}
          {questions.length === 0 && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{(parsed.summary || content)}</p>
          )}
        </div>
      );
    }
    if (parsed.summary) {
      return <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{parsed.summary}</p>;
    }
  } catch {}
  return <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{content}</p>;
}

function GradingDetails({ feedback }: { feedback: string }) {
  try {
    const details: QuestionResult[] = JSON.parse(feedback);
    if (Array.isArray(details) && details.length > 0) {
      return (
        <div className="space-y-1 mt-2">
          {details.map((d, i) => (
            <div key={d.questionId} className="text-xs text-gray-500 flex items-center gap-2">
              <span className="font-medium">C{i + 1}:</span>
              <Badge variant="outline" className="text-xs">{d.score}/{d.maxScore}</Badge>
              <span className="truncate">{d.feedback}</span>
            </div>
          ))}
        </div>
      );
    }
  } catch {}
  return <p className="text-sm text-gray-600 mt-2 w-full">{feedback}</p>;
}

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
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Teacher grading state
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [grading, setGrading] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);

  const isTeacher = user?.role === "TEACHER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const mySubmission = submissions.find((s) => s.studentId === user?.id);

  // Weakness auto-resolve tracking
  const [weaknessId, setWeaknessId] = useState<string | null>(null);
  const correctRef = useRef(new Set<number>());
  const attemptedRef = useRef(new Set<number>());
  const answersRef = useRef<(ExerciseAnswer | null)[]>([]);
  const [allExercisesCorrect, setAllExercisesCorrect] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setWeaknessId(params.get("weaknessId"));
  }, []);

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
          loadData();
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

  // Parse grading details from submission feedback
  const gradingDetails: QuestionResult[] = (() => {
    if (!mySubmission?.feedback) return [];
    try {
      const parsed = JSON.parse(mySubmission.feedback);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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

  const handleSubmit = async () => {
    const hasQuestions = questions.length > 0;
    if (!hasQuestions && !answer.trim()) return;
    if (hasQuestions && Object.values(perQuestionAnswers).every((v) => !v.trim())) return;
    setSubmitting(true);
    try {
      const content = hasQuestions
        ? JSON.stringify({
            answers: questions.map((q) => ({
              questionId: q.id,
              answer: perQuestionAnswers[q.id] || "",
            })),
          })
        : answer;
      await api(`/api/assignments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ assignmentId: id, content }),
      });
      setSubmitted(true);
      setAnswer("");
      setPerQuestionAnswers({});
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId: string) => {
    setGrading(true);
    try {
      await api(`/api/submissions/${submissionId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({ score: parseInt(gradeScore), feedback: gradeFeedback }),
      });
      setGradingId(null);
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGrading(false);
    }
  };

  const handleAutoGrade = async (submissionId: string) => {
    setAutoGrading(true);
    try {
      await api(`/api/submissions/${submissionId}/auto-grade`, { method: "POST" });
      loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAutoGrading(false);
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
                    lessonId={assignment.id}
                  />
                ))}
              </div>
            ) : questions.length > 0 ? (
              <div className="mt-3 space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-bold text-purple-600 mb-1">Câu {i + 1} ({q.score || 10}đ)</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{q.question}</p>
                  </div>
                ))}
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

      {/* Student: submission form (skip for weakness — exercises auto-submit) */}
      {!isTeacher && !mySubmission && assignment.source !== "weakness" && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Nộp bài</h2>
          {questions.length > 0 ? (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id}>
                  <Label className="text-sm font-medium text-gray-700">
                    Câu {i + 1} ({q.score || 10}đ)
                  </Label>
                  <p className="text-sm text-gray-600 mb-2">{q.question}</p>
                  <Textarea
                    value={perQuestionAnswers[q.id] || ""}
                    onChange={(e) =>
                      setPerQuestionAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Nhập câu trả lời của bạn..."
                    rows={3}
                    disabled={submitting}
                  />
                </div>
              ))}
              <Button
                onClick={handleSubmit}
                disabled={
                  Object.values(perQuestionAnswers).every((v) => !v.trim()) || submitting
                }
              >
                {submitting ? "Đang nộp..." : "Nộp bài"}
                <Send className="size-4 ml-2" />
              </Button>
            </div>
          ) : (
            <>
              <Textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Nhập câu trả lời của bạn..."
                rows={6}
                className="mb-3"
                disabled={submitting}
              />
              <Button onClick={handleSubmit} disabled={!answer.trim() || submitting}>
                {submitting ? "Đang nộp..." : "Nộp bài"}
                <Send className="size-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Student: my graded submission */}
      {!isTeacher && mySubmission && (
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
                  <p className="text-xs text-gray-500">{detail.feedback}</p>
                </div>
              ))}
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

      {/* Teacher: submissions list */}
      {isTeacher && (
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              Bài nộp của học sinh ({submissions.length})
            </h2>
          </div>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="size-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Chưa có học sinh nào nộp bài</p>
            </div>
          ) : (
            <div className="divide-y">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{sub.studentName}</span>
                      <span className="text-sm text-gray-400 ml-2">
                        {new Date(sub.submittedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.score != null && (
                        <Badge variant="default">{sub.score}/{assignment.maxScore}</Badge>
                      )}
                      <Badge>{statusLabel[sub.status] || sub.status}</Badge>
                    </div>
                  </div>
                  <SubmissionContent content={sub.content} questions={questions} />
                  {sub.feedback && (
                    <GradingDetails feedback={sub.feedback} />
                  )}

                  {gradingId === sub.id ? (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={gradeScore}
                          onChange={(e) => setGradeScore(e.target.value)}
                          placeholder="Điểm"
                          className="w-20 rounded-md border px-2 py-1 text-sm"
                          min={0}
                          max={assignment.maxScore}
                        />
                        <span className="text-sm text-gray-400">/ {assignment.maxScore}</span>
                      </div>
                      <Textarea
                        value={gradeFeedback}
                        onChange={(e) => setGradeFeedback(e.target.value)}
                        placeholder="Nhận xét..."
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleGrade(sub.id)} disabled={grading}>
                          {grading ? "Đang chấm..." : "Chấm điểm"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setGradingId(null)}>
                          Huỷ
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      {sub.score == null && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGradingId(sub.id);
                              setGradeScore("");
                              setGradeFeedback("");
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
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
