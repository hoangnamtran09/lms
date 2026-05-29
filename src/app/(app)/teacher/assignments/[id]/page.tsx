"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Sparkles, Pencil, Check, X, Save, ChevronDown, ChevronRight, Send } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  classId?: string;
  studentIds?: string;
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

interface ClassItem {
  id: string;
  name: string;
}

interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
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
// Page
// ---------------------------------------------------------------------------

export default function TeacherAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  // Question editing state
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [publishing, setPublishing] = useState(false);

  const isMcqQuestion = (q: Question) => q.type === "mcq" || (q.options !== undefined && q.options.length > 0);

  // Publish dialog
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishClassId, setPublishClassId] = useState("");
  const [publishStudentIds, setPublishStudentIds] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentBrief[]>([]);

  const openPublishDialog = () => {
    // Parse existing studentIds and classId from assignment
    let existingStudentIds: string[] = [];
    if (assignment?.studentIds) {
      try { existingStudentIds = JSON.parse(assignment.studentIds); } catch {}
    }
    setPublishStudentIds(existingStudentIds);
    setPublishClassId(assignment?.classId || "");
    setPublishDialogOpen(true);

    // Load classes and students
    api<ClassItem[]>("/api/classes").then((d) => setAvailableClasses(d || [])).catch(() => {});
    const studentsUrl = assignment?.classId
      ? `/api/users?role=STUDENT&classId=${assignment.classId}`
      : "/api/users?role=STUDENT";
    api<StudentBrief[]>(studentsUrl).then((d) => setAvailableStudents(d || [])).catch(() => {});
  };

  // Reload students when publish class changes
  const handlePublishClassChange = (classId: string) => {
    setPublishClassId(classId);
    setPublishStudentIds([]);
    const url = classId ? `/api/users?role=STUDENT&classId=${classId}` : "/api/users?role=STUDENT";
    api<StudentBrief[]>(url).then((d) => setAvailableStudents(d || [])).catch(() => {});
  };

  const handleConfirmPublish = async () => {
    setPublishing(true);
    try {
      const body: Record<string, unknown> = {
        status: "ASSIGNED",
        classId: publishClassId,
        studentIds: publishStudentIds.length > 0 ? JSON.stringify(publishStudentIds) : "",
      };
      await api(`/api/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setPublishDialogOpen(false);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi giao bài");
    } finally {
      setPublishing(false);
    }
  };

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

  // ---- Question editing ----
  const startEditingQuestions = () => {
    setEditedQuestions(JSON.parse(JSON.stringify(questions)));
    setEditingQuestions(true);
  };

  const cancelEditingQuestions = () => {
    setEditedQuestions([]);
    setEditingQuestions(false);
  };

  const updateEditedQuestion = (index: number, field: string, value: unknown) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateEditedOption = (qIndex: number, optIndex: number, field: string, value: unknown) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = [...(next[qIndex].options || [])];
      options[optIndex] = { ...options[optIndex], [field]: value };
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  };

  const addOption = (qIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = [...(next[qIndex].options || []), { text: "", isCorrect: false }];
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = (next[qIndex].options || []).filter((_, i) => i !== optIndex);
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  };

  const handleSaveQuestions = async () => {
    setSavingQuestions(true);
    try {
      await api(`/api/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ questions: JSON.stringify(editedQuestions) }),
      });
      setEditingQuestions(false);
      setEditedQuestions([]);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi lưu câu hỏi");
    } finally {
      setSavingQuestions(false);
    }
  };

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
        <Link href="/teacher/assignments" className="text-sm text-primary hover:underline mt-2 inline-block">
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Back link */}
      <Link
        href="/teacher/assignments"
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
              {assignment.status === "DRAFT" && (
                <Button
                  size="sm"
                  onClick={openPublishDialog}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Send className="size-3.5" />
                  Giao bài
                </Button>
              )}
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
            {assignment.dueDate && new Date(assignment.dueDate).getFullYear() > 1 && (
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

      {/* Questions section */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <button
            onClick={() => setQuestionsExpanded(!questionsExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 rounded-t-xl"
          >
            <div className="flex items-center gap-3">
              {questionsExpanded ? <ChevronDown className="size-5 text-gray-400" /> : <ChevronRight className="size-5 text-gray-400" />}
              <h2 className="font-semibold text-gray-900">Danh sách câu hỏi ({questions.length})</h2>
            </div>
            {!editingQuestions && (
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); startEditingQuestions(); }}>
                <Pencil className="size-3 mr-1" /> Chỉnh sửa
              </Button>
            )}
          </button>

          {questionsExpanded && (
            <div className="px-6 pb-6 border-t">
              {/* Edit mode actions */}
              {editingQuestions && (
                <div className="flex items-center gap-2 py-4 border-b mb-4">
                  <Button onClick={handleSaveQuestions} disabled={savingQuestions} size="sm" className="gap-1.5">
                    <Save className="size-3.5" />
                    {savingQuestions ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEditingQuestions} disabled={savingQuestions}>
                    <X className="size-3.5 mr-1" /> Huỷ
                  </Button>
                </div>
              )}

              <div className="space-y-4 mt-4">
                {(editingQuestions ? editedQuestions : questions).map((q, qi) => (
                  <div key={q.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    {/* Question header */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="font-bold text-gray-900 mt-1 shrink-0">Câu {qi + 1}</span>

                      {editingQuestions ? (
                        <div className="flex-1 space-y-3">
                          {/* Question text */}
                          <div>
                            <Label className="text-xs text-gray-500">Câu hỏi</Label>
                            <Textarea
                              value={q.question}
                              onChange={(e) => updateEditedQuestion(qi, "question", e.target.value)}
                              rows={2}
                              className="rounded-lg mt-1"
                            />
                          </div>

                          {/* Type + Difficulty + Score row */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs text-gray-500">Loại</Label>
                              <Select value={q.type || "mcq"} onValueChange={(v) => updateEditedQuestion(qi, "type", v)}>
                                <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                                  <SelectItem value="short_answer">Tự luận</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Mức độ</Label>
                              <Select value={q.difficulty || "thong_hieu"} onValueChange={(v) => updateEditedQuestion(qi, "difficulty", v)}>
                                <SelectTrigger className="rounded-lg mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nhan_biet">Nhận biết</SelectItem>
                                  <SelectItem value="thong_hieu">Thông hiểu</SelectItem>
                                  <SelectItem value="van_dung">Vận dụng</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Điểm</Label>
                              <Input
                                type="number"
                                value={q.score || 10}
                                onChange={(e) => updateEditedQuestion(qi, "score", parseInt(e.target.value) || 0)}
                                min={1}
                                className="rounded-lg mt-1"
                              />
                            </div>
                          </div>

                          {/* Expected answer */}
                          <div>
                            <Label className="text-xs text-gray-500">Đáp án</Label>
                            <Input
                              value={q.expectedAnswer || ""}
                              onChange={(e) => updateEditedQuestion(qi, "expectedAnswer", e.target.value)}
                              placeholder="Đáp án mong đợi"
                              className="rounded-lg mt-1"
                            />
                          </div>

                          {/* MCQ Options */}
                          {q.type === "mcq" && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-xs text-gray-500">Lựa chọn</Label>
                                <Button variant="ghost" size="sm" onClick={() => addOption(qi)} className="text-xs h-6">+ Thêm lựa chọn</Button>
                              </div>
                              <div className="space-y-2">
                                {(q.options || []).map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`correct-${q.id}`}
                                      checked={opt.isCorrect}
                                      onChange={() => {
                                        // Set this option as correct, others as incorrect
                                        setEditedQuestions((prev) => {
                                          const next = [...prev];
                                          const opts = (next[qi].options || []).map((o, i) => ({ ...o, isCorrect: i === oi }));
                                          next[qi] = { ...next[qi], options: opts };
                                          return next;
                                        });
                                      }}
                                      className="size-4"
                                    />
                                    <Input
                                      value={opt.text}
                                      onChange={(e) => updateEditedOption(qi, oi, "text", e.target.value)}
                                      placeholder={`Lựa chọn ${oi + 1}`}
                                      className="rounded-lg flex-1 h-8 text-sm"
                                    />
                                    <Button variant="ghost" size="sm" onClick={() => removeOption(qi, oi)} className="text-red-400 hover:text-red-600 h-8 w-8 p-0">
                                      <X className="size-3.5" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Explanation */}
                          <div>
                            <Label className="text-xs text-gray-500">Giải thích</Label>
                            <Textarea
                              value={q.explanation || ""}
                              onChange={(e) => updateEditedQuestion(qi, "explanation", e.target.value)}
                              placeholder="Giải thích đáp án"
                              rows={2}
                              className="rounded-lg mt-1 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex-1">
                          <p className="text-gray-900 font-medium">{q.question}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}
                            </Badge>
                            {q.difficulty && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100"}`}>
                                {difficultyLabels[q.difficulty] || q.difficulty}
                              </span>
                            )}
                            <Badge variant="outline" className="text-xs">{q.score || 10} điểm</Badge>
                            {q.expectedAnswer && (
                              <span className="text-xs text-gray-500">Đáp án: {q.expectedAnswer}</span>
                            )}
                          </div>
                          {/* MCQ options display */}
                          {q.type === "mcq" && q.options && q.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {q.options.map((opt, oi) => (
                                <span key={oi} className={`text-xs px-2 py-1 rounded-full border ${opt.isCorrect ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                  {String.fromCharCode(65 + oi)}. {opt.text} {opt.isCorrect ? "✓" : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {q.explanation && (
                            <p className="text-xs text-gray-400 mt-2 italic">💡 {q.explanation}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom save button */}
              {editingQuestions && (
                <div className="flex items-center gap-2 pt-4 border-t mt-4">
                  <Button onClick={handleSaveQuestions} disabled={savingQuestions} className="gap-1.5">
                    <Save className="size-4" />
                    {savingQuestions ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button variant="outline" onClick={cancelEditingQuestions} disabled={savingQuestions}>
                    <X className="size-4 mr-1" /> Huỷ
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                <div key={sub.id} className={`${rowStyle}`}>
                  <button
                    onClick={() => setSelectedSubmission(sub)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900">{sub.studentName}</span>
                      <span className="text-sm text-gray-400">
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
                  </button>
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

      {/* Submission Detail Dialog — Stitch Design */}
      <Dialog open={!!selectedSubmission} onOpenChange={(open) => { if (!open) setSelectedSubmission(null); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {selectedSubmission && (() => {
            // Parse student answers
            const answerMap = new Map<string, string>();
            try {
              const parsed = JSON.parse(selectedSubmission.content);
              if (parsed.answers) {
                parsed.answers.forEach((a: { questionId: string; answer: string }) => {
                  answerMap.set(a.questionId, a.answer || "");
                });
              }
            } catch {}

            // Parse grading results
            const gradeMap = new Map<string, { score: number; maxScore: number; feedback: string }>();
            try {
              let feedback = selectedSubmission.feedback || "";
              const start = feedback.indexOf("[");
              if (start >= 0) {
                const details = JSON.parse(feedback.substring(start));
                if (Array.isArray(details)) {
                  details.forEach((d: { questionId: string; score: number; maxScore: number; feedback: string }) => {
                    gradeMap.set(d.questionId, { score: d.score, maxScore: d.maxScore, feedback: d.feedback });
                  });
                }
              }
            } catch {}

            // Compute stats
            const totalQ = questions.length;
            const correctCount = Array.from(gradeMap.values()).filter((g) => g.feedback === "Đúng").length;
            const wrongCount = Array.from(gradeMap.values()).filter((g) => g.feedback === "Sai" || g.feedback === "Chưa trả lời").length;
            const scoreDisplay = selectedSubmission.score != null ? selectedSubmission.score : 0;
            const submitDate = new Date(selectedSubmission.submittedAt);
            const timeStr = submitDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
            const dateStr = submitDate.toLocaleDateString("vi-VN");

            return (
              <>
                {/* Header */}
                <div className="shrink-0 px-6 py-5 border-b bg-gradient-to-r from-blue-50 to-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar placeholder */}
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                        {selectedSubmission.studentName?.charAt(0) || "?"}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{selectedSubmission.studentName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {statusLabel[selectedSubmission.status] || selectedSubmission.status}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            Nộp lúc {timeStr} — {dateStr}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedSubmission.score == null ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => {
                            const idx = submissions.findIndex((s) => s.id === selectedSubmission.id);
                            setGradingSheetIndex(idx >= 0 ? idx : 0);
                            setGradingSheetOpen(true);
                            setSelectedSubmission(null);
                          }}>Chấm điểm</Button>
                          <Button size="sm" variant="outline" onClick={() => handleAutoGrade(selectedSubmission.id)} disabled={autoGrading}>
                            <Sparkles className="size-3 mr-1" />Chấm AI
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => {
                          const idx = submissions.findIndex((s) => s.id === selectedSubmission.id);
                          setGradingSheetIndex(idx >= 0 ? idx : 0);
                          setGradingSheetOpen(true);
                          setSelectedSubmission(null);
                        }}>Xem / sửa điểm</Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Bento Grid */}
                <div className="shrink-0 grid grid-cols-4 gap-3 px-6 py-4 border-b bg-gray-50/50">
                  {[
                    { icon: "📝", label: "Điểm số", value: `${scoreDisplay}/${assignment.maxScore}`, color: "text-blue-600" },
                    { icon: "✅", label: "Đúng", value: `${correctCount}/${totalQ}`, color: "text-emerald-600" },
                    { icon: "❌", label: "Sai", value: `${wrongCount}/${totalQ}`, color: "text-red-500" },
                    { icon: "⏱️", label: "Thời gian", value: timeStr, color: "text-purple-600" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl border p-3 flex items-center gap-3">
                      <div className="text-xl">{stat.icon}</div>
                      <div>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Content: Questions + Sidebar */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Questions List */}
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {questions.map((q, qi) => {
                      const grade = gradeMap.get(q.id);
                      const studentAns = answerMap.get(q.id) || "";
                      const isMcq = isMcqQuestion(q);
                      const isCorrect = grade?.feedback === "Đúng";
                      const isWrong = grade?.feedback === "Sai" || grade?.feedback === "Chưa trả lời";
                      const options = isMcq ? (q.options && q.options.length > 0 ? q.options : []) : [];

                      return (
                        <div key={q.id} id={`popup-question-${qi}`} className={`bg-white rounded-xl border overflow-hidden scroll-mt-4 ${isCorrect ? "border-emerald-200" : isWrong ? "border-red-200" : "border-gray-200"}`}>
                          {/* Question header */}
                          <div className={`px-5 py-3 border-b flex items-center justify-between ${isCorrect ? "bg-emerald-50/50" : isWrong ? "bg-red-50/50" : "bg-gray-50/50"}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-400">CÂU {qi + 1}</span>
                              {q.difficulty && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || ""}`}>
                                  {difficultyLabels[q.difficulty] || q.difficulty}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">({q.score || 10}đ)</span>
                            </div>
                            {grade && (
                              isCorrect ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                  <Check className="size-3.5" /> Chính xác
                                </span>
                              ) : isWrong ? (
                                <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                                  <X className="size-3.5" /> {grade.feedback === "Chưa trả lời" ? "Chưa trả lời" : "Sai sót"}
                                </span>
                              ) : null
                            )}
                          </div>

                          {/* Question text */}
                          <div className="px-5 py-3">
                            <p className="text-sm font-medium text-gray-800">{q.question}</p>
                          </div>

                          {/* MCQ Options */}
                          {isMcq && options.length > 0 && (
                            <div className="px-5 pb-3 space-y-1.5">
                              {options.map((opt, oi) => {
                                const letter = String.fromCharCode(65 + oi);
                                const isStudentChoice = studentAns.toUpperCase() === letter;
                                const isCorrectOpt = opt.isCorrect;
                                let optStyle = "border-gray-200 bg-white";
                                if (isStudentChoice && isCorrectOpt) optStyle = "border-emerald-500 bg-emerald-50";
                                else if (isStudentChoice && !isCorrectOpt) optStyle = "border-red-400 bg-red-50";
                                else if (!isStudentChoice && isCorrectOpt && grade) optStyle = "border-emerald-400 bg-emerald-50/50";

                                return (
                                  <div key={oi} className={`flex items-center px-4 py-2.5 rounded-lg border text-sm ${optStyle}`}>
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-3 ${isStudentChoice ? (isCorrectOpt ? "bg-emerald-500 text-white" : "bg-red-500 text-white") : isCorrectOpt && grade ? "bg-emerald-500 text-white" : "border-2 border-gray-300 text-gray-500"}`}>
                                      {letter}
                                    </span>
                                    <span className="flex-1">{opt.text}</span>
                                    {isStudentChoice && <span className="text-xs text-gray-400 ml-2">(HS chọn)</span>}
                                    {!isStudentChoice && isCorrectOpt && grade && <span className="text-xs text-emerald-600 ml-2">✓ Đáp án</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Short answer (non-MCQ) */}
                          {!isMcq && (
                            <div className="px-5 pb-3">
                              <div className="p-3 bg-gray-50 rounded-lg border">
                                <p className="text-xs text-gray-500 mb-1">Câu trả lời của học sinh:</p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{studentAns || "(không trả lời)"}</p>
                              </div>
                              {q.expectedAnswer && (
                                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mt-2">
                                  <p className="text-xs text-emerald-600 mb-1">Đáp án mong đợi:</p>
                                  <p className="text-sm text-gray-700">{q.expectedAnswer}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Sidebar */}
                  <div className="w-72 shrink-0 border-l bg-gray-50/30 overflow-y-auto p-4 space-y-4">
                    {/* Question Nav Grid */}
                    <div className="bg-white rounded-xl border p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Danh sách câu hỏi</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {questions.map((q, qi) => {
                          const grade = gradeMap.get(q.id);
                          const isCorrect = grade?.feedback === "Đúng";
                          const isWrong = grade?.feedback === "Sai" || grade?.feedback === "Chưa trả lời";
                          let btnColor = "bg-gray-100 text-gray-500 border border-gray-200";
                          if (isCorrect) btnColor = "bg-emerald-500 text-white";
                          else if (isWrong) btnColor = "bg-red-500 text-white";

                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                const el = document.getElementById(`popup-question-${qi}`);
                                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                              }}
                              className={`w-9 h-9 rounded-lg text-xs font-bold flex items-center justify-center ${btnColor}`}
                            >
                              {qi + 1}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-3 mt-3 text-[11px] font-medium text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Đúng</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500" /> Sai</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 border" /> Chưa làm</span>
                      </div>
                    </div>

                    {/* Grading Summary */}
                    {selectedSubmission.feedback && (
                      <div className="bg-white rounded-xl border p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-purple-500" /> Kết quả chấm
                        </h4>
                        <div className="space-y-1.5">
                          {questions.map((q, qi) => {
                            const grade = gradeMap.get(q.id);
                            if (!grade) return null;
                            return (
                              <div key={q.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">Câu {qi + 1}</span>
                                <span className={`font-semibold ${grade.feedback === "Đúng" ? "text-emerald-600" : grade.feedback === "Chưa trả lời" ? "text-amber-500" : "text-red-500"}`}>
                                  {grade.score}/{grade.maxScore}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-3 pt-3 border-t flex justify-between">
                          <span className="text-sm font-semibold text-gray-700">Tổng</span>
                          <span className="text-sm font-bold text-primary">{scoreDisplay}/{assignment.maxScore}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Giao bài: {assignment.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* Class selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700">Chọn lớp</Label>
              <Select value={publishClassId} onValueChange={(v) => handlePublishClassChange(v ?? "")}>
                <SelectTrigger className="rounded-xl mt-1.5 w-full">
                  <SelectValue placeholder="Chọn lớp học..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả các lớp</SelectItem>
                  {availableClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Chọn học sinh ({publishStudentIds.length > 0 ? publishStudentIds.length : "cả lớp"})
                </Label>
                {publishStudentIds.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setPublishStudentIds([])} className="text-xs h-6 text-gray-500">
                    Bỏ chọn tất cả
                  </Button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-0.5">
                {availableStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {publishClassId ? "Không có học sinh nào trong lớp này" : "Chọn lớp để xem danh sách học sinh"}
                  </p>
                ) : (
                  availableStudents.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={publishStudentIds.includes(s.supabaseId)}
                        onChange={() => setPublishStudentIds((prev) =>
                          prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId]
                        )}
                        className="size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm">{s.fullName}</span>
                    </label>
                  ))
                )}
              </div>
              {publishStudentIds.length > 0 && availableStudents.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Đã chọn {publishStudentIds.length}/{availableStudents.length} học sinh
                </p>
              )}
              {publishStudentIds.length === 0 && availableStudents.length > 0 && (
                <p className="text-xs text-amber-500 mt-1.5">
                  Để trống = giao cho tất cả học sinh trong lớp
                </p>
              )}
            </div>

            {/* Summary */}
            <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Lớp:</span> {publishClassId ? (availableClasses.find((c) => c.id === publishClassId)?.name || publishClassId) : "Tất cả"}</p>
              <p><span className="font-medium">Số học sinh:</span> {publishStudentIds.length > 0 ? publishStudentIds.length : "Cả lớp"}</p>
              <p><span className="font-medium">Số câu hỏi:</span> {questions.length}</p>
              <p><span className="font-medium">Tổng điểm:</span> {assignment.maxScore}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button onClick={handleConfirmPublish} disabled={publishing} className="gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Send className="size-4" />
                {publishing ? "Đang giao..." : "Xác nhận giao bài"}
              </Button>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)} disabled={publishing} className="flex-1">
                Huỷ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
