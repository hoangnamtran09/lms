"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles, RefreshCw, FileText, Check, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Assignment {
  id: string;
  title: string;
  description: string;
  rubric: string;
  maxScore: number;
  dueDate: string;
  status: string;
  creatorName: string;
  createdAt: string;
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
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await api(`/api/assignments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ assignmentId: id, content: answer }),
      });
      setSubmitted(true);
      setAnswer("");
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
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
    <div>
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
              <Badge>{statusLabel[assignment.status] || assignment.status}</Badge>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap">{assignment.description || "Không có mô tả"}</p>
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

      {/* Student: submission form */}
      {!isTeacher && !mySubmission && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Nộp bài</h2>
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
        </div>
      )}

      {/* Student: my graded submission */}
      {!isTeacher && mySubmission && (
        <div className="bg-white rounded-lg border p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Bài nộp của bạn</h2>
          <div className="p-3 bg-gray-50 rounded-lg mb-3">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{mySubmission.content}</p>
          </div>
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
              {mySubmission.feedback && (
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
                  <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{sub.content}</p>

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
                      {sub.feedback && (
                        <p className="text-sm text-gray-600 mt-2 w-full">{sub.feedback}</p>
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
