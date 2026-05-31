"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Pencil,
  Save,
  ChevronDown,
  ChevronRight,
  Send,
  ExternalLink,
  X,
  Users,
  CheckCircle2,
  Clock,
  GraduationCap,
  Calendar,
  Award,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  nhan_biet: "bg-emerald-50 text-emerald-700 border-emerald-200",
  thong_hieu: "bg-blue-50 text-blue-700 border-blue-200",
  van_dung: "bg-orange-50 text-orange-700 border-orange-200",
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
  DRAFT: "Bản nháp",
  ASSIGNED: "Đã giao",
  SUBMITTED: "Đang nhận bài",
  GRADED: "Đã chấm xong",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

const statusStyle: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-50 text-blue-700",
  SUBMITTED: "bg-amber-50 text-amber-700",
  GRADED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-orange-50 text-orange-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TeacherAssignmentDetailPage({
  params,
  basePath = "/teacher",
}: {
  params: Promise<{ id: string }>;
  basePath?: string;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Grading
  const [gradingSheetOpen, setGradingSheetOpen] = useState(false);
  const [gradingSheetIndex, setGradingSheetIndex] = useState(0);

  // Question editing
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsExpanded, setQuestionsExpanded] = useState(true);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishClassId, setPublishClassId] = useState("");
  const [publishStudentIds, setPublishStudentIds] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [availableStudents, setAvailableStudents] = useState<StudentBrief[]>([]);

  // ---- Data loading ----
  const loadData = () => {
    Promise.all([
      api<Assignment>(`/api/assignments/${id}`),
      api<Submission[]>(`/api/assignments/${id}/submissions`),
    ])
      .then(([a, s]) => {
        setAssignment(a);
        setSubmissions(s);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadData();
  }, [id]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // ---- Publish ----
  const openPublishDialog = () => {
    let existingStudentIds: string[] = [];
    if (assignment?.studentIds) {
      try {
        existingStudentIds = JSON.parse(assignment.studentIds);
      } catch {}
    }
    setPublishStudentIds(existingStudentIds);
    setPublishClassId(assignment?.classId || "");
    setPublishDialogOpen(true);
    api<ClassItem[]>("/api/classes")
      .then((d) => setAvailableClasses(d || []))
      .catch(() => {});
    const studentsUrl = assignment?.classId
      ? `/api/users?role=STUDENT&classId=${assignment.classId}`
      : "/api/users?role=STUDENT";
    api<StudentBrief[]>(studentsUrl)
      .then((d) => setAvailableStudents(d || []))
      .catch(() => {});
  };

  const handlePublishClassChange = (classId: string) => {
    setPublishClassId(classId);
    setPublishStudentIds([]);
    const url = classId
      ? `/api/users?role=STUDENT&classId=${classId}`
      : "/api/users?role=STUDENT";
    api<StudentBrief[]>(url)
      .then((d) => setAvailableStudents(d || []))
      .catch(() => {});
  };

  const handleConfirmPublish = async () => {
    setPublishing(true);
    try {
      await api(`/api/assignments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "ASSIGNED",
          classId: publishClassId,
          studentIds:
            publishStudentIds.length > 0
              ? JSON.stringify(publishStudentIds)
              : "",
        }),
      });
      setPublishDialogOpen(false);
      loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi giao bài");
    } finally {
      setPublishing(false);
    }
  };

  // ---- Question editing ----
  const startEditingQuestions = () => {
    setEditedQuestions(JSON.parse(JSON.stringify(questions)));
    setEditingQuestions(true);
  };

  const cancelEditingQuestions = () => {
    setEditedQuestions([]);
    setEditingQuestions(false);
  };

  const updateEditedQuestion = (
    index: number,
    field: string,
    value: unknown
  ) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const updateEditedOption = (
    qIndex: number,
    optIndex: number,
    field: string,
    value: unknown
  ) => {
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
      const options = [
        ...(next[qIndex].options || []),
        { text: "", isCorrect: false },
      ];
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  };

  const removeOption = (qIndex: number, optIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = (next[qIndex].options || []).filter(
        (_, i) => i !== optIndex
      );
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

  // ---- Derived data ----
  const questions: Question[] = (() => {
    if (!assignment?.questions) return [];
    try {
      const parsed = JSON.parse(assignment.questions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const gradedCount = submissions.filter((s) => s.score != null).length;
  const ungradedCount = submissions.filter(
    (s) => s.status === "SUBMITTED" && s.score == null
  ).length;
  const submittedCount = submissions.filter(
    (s) => s.status !== "ASSIGNED"
  ).length;
  const avgScore =
    gradedCount > 0
      ? (
          submissions
            .filter((s) => s.score != null)
            .reduce((sum, s) => sum + (s.score || 0), 0) / gradedCount
        ).toFixed(1)
      : null;

  // ---- Loading / Error ----
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-6xl pb-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <FileText className="size-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">
          {error || "Không tìm thấy bài tập"}
        </p>
        <Link
          href={`${basePath}/assignments`}
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          Quay lại danh sách bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
        <Link
          href={basePath}
          className="hover:text-blue-600 transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight className="size-3" />
        <Link
          href={`${basePath}/assignments`}
          className="hover:text-blue-600 transition-colors"
        >
          Assignments
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-blue-600 font-bold">{assignment.title}</span>
      </nav>

      {/* Assignment Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-6 relative overflow-hidden">
        {/* Left accent bar */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex-1">
            {/* Status + source badges */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  statusStyle[assignment.status] || statusStyle.DRAFT
                }`}
              >
                {statusLabel[assignment.status] || assignment.status}
              </span>
              {assignment.source === "weakness" && (
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700">
                  Khắc phục
                </span>
              )}
              {assignment.status === "DRAFT" && (
                <Button
                  size="sm"
                  onClick={openPublishDialog}
                  className="gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                >
                  <Send className="size-3.5" />
                  Giao bài
                </Button>
              )}
            </div>

            {/* Title */}
            <h1 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-3">
              {assignment.title}
            </h1>
            <p className="text-base text-gray-500 mb-4">
              {assignment.description || "Không có mô tả"}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {assignment.creatorName && (
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="size-4 text-gray-400" />
                  <span>{assignment.creatorName}</span>
                </div>
              )}
              {assignment.dueDate &&
                new Date(assignment.dueDate).getFullYear() > 2000 && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-4 text-gray-400" />
                    <span>
                      Hạn:{" "}
                      {new Date(assignment.dueDate).toLocaleDateString(
                        "vi-VN"
                      )}
                    </span>
                  </div>
                )}
              {questions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="size-4 text-gray-400" />
                  <span>{questions.length} câu hỏi</span>
                </div>
              )}
            </div>

            {/* Difficulty breakdown */}
            {questions.some((q) => q.difficulty) && (
              <div className="flex items-center gap-2 mt-3">
                {["nhan_biet", "thong_hieu", "van_dung"].map((d) => {
                  const count = questions.filter(
                    (q) => q.difficulty === d
                  ).length;
                  if (count === 0) return null;
                  return (
                    <span
                      key={d}
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        difficultyColors[d] || ""
                      }`}
                    >
                      {difficultyLabels[d]}: {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right meta box */}
          <div className="lg:w-56 shrink-0 bg-gray-50 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Điểm tối đa</span>
              <span className="text-xl font-bold text-blue-600">
                {assignment.maxScore}
              </span>
            </div>
            {assignment.rubric && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Tiêu chí chấm
                </p>
                <p className="text-sm text-gray-600">{assignment.rubric}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Tổng bài nộp */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="size-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Tổng bài nộp
            </p>
            <p className="text-[28px] font-bold tracking-[-0.02em] text-blue-600 leading-none">
              {submissions.length}
            </p>
          </div>
        </div>

        {/* Đã nộp */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Đã nộp
            </p>
            <p className="text-[28px] font-bold tracking-[-0.02em] text-emerald-600 leading-none">
              {submittedCount}
            </p>
          </div>
        </div>

        {/* Cần chấm */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow border-l-4 border-l-pink-500">
          <div className="size-14 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 shrink-0">
            <Clock className="size-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Cần chấm
            </p>
            <p className="text-[28px] font-bold tracking-[-0.02em] text-pink-600 leading-none">
              {ungradedCount}
            </p>
          </div>
        </div>

        {/* Điểm trung bình */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="size-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Award className="size-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Điểm TB
            </p>
            <p className="text-[28px] font-bold tracking-[-0.02em] text-purple-600 leading-none">
              {avgScore ?? "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Questions Section */}
      {questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setQuestionsExpanded(!questionsExpanded)}
            className="w-full px-8 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {questionsExpanded ? (
                <ChevronDown className="size-5 text-gray-400" />
              ) : (
                <ChevronRight className="size-5 text-gray-400" />
              )}
              <h2 className="text-lg font-semibold text-gray-900">
                Danh sách câu hỏi ({questions.length})
              </h2>
            </div>
            {!editingQuestions && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditingQuestions();
                }}
                className="rounded-xl gap-1.5"
              >
                <Pencil className="size-3.5" />
                Chỉnh sửa
              </Button>
            )}
          </button>

          {questionsExpanded && (
            <div className="px-8 pb-8 border-t border-gray-100">
              {editingQuestions && (
                <div className="flex items-center gap-2 py-4 border-b border-gray-100 mb-6">
                  <Button
                    onClick={handleSaveQuestions}
                    disabled={savingQuestions}
                    className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="size-4" />
                    {savingQuestions ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditingQuestions}
                    disabled={savingQuestions}
                    className="rounded-xl"
                  >
                    <X className="size-4 mr-1" /> Huỷ
                  </Button>
                </div>
              )}

              <div className="space-y-4 mt-6">
                {(editingQuestions ? editedQuestions : questions).map(
                  (q, qi) => (
                    <div
                      key={q.id}
                      className="p-5 bg-gray-50/70 rounded-2xl border border-gray-100"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="font-bold text-gray-900 mt-1 shrink-0">
                          Câu {qi + 1}
                        </span>

                        {editingQuestions ? (
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Câu hỏi
                              </Label>
                              <Textarea
                                value={q.question}
                                onChange={(e) =>
                                  updateEditedQuestion(
                                    qi,
                                    "question",
                                    e.target.value
                                  )
                                }
                                rows={2}
                                className="rounded-xl mt-1"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                  Loại
                                </Label>
                                <Select
                                  value={q.type || "mcq"}
                                  onValueChange={(v) =>
                                    updateEditedQuestion(qi, "type", v)
                                  }
                                >
                                  <SelectTrigger className="rounded-xl mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mcq">
                                      Trắc nghiệm
                                    </SelectItem>
                                    <SelectItem value="short_answer">
                                      Tự luận
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                  Mức độ
                                </Label>
                                <Select
                                  value={q.difficulty || "thong_hieu"}
                                  onValueChange={(v) =>
                                    updateEditedQuestion(qi, "difficulty", v)
                                  }
                                >
                                  <SelectTrigger className="rounded-xl mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="nhan_biet">
                                      Nhận biết
                                    </SelectItem>
                                    <SelectItem value="thong_hieu">
                                      Thông hiểu
                                    </SelectItem>
                                    <SelectItem value="van_dung">
                                      Vận dụng
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                  Điểm
                                </Label>
                                <Input
                                  type="number"
                                  value={q.score || 10}
                                  onChange={(e) =>
                                    updateEditedQuestion(
                                      qi,
                                      "score",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  min={1}
                                  className="rounded-xl mt-1"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Đáp án
                              </Label>
                              <Input
                                value={q.expectedAnswer || ""}
                                onChange={(e) =>
                                  updateEditedQuestion(
                                    qi,
                                    "expectedAnswer",
                                    e.target.value
                                  )
                                }
                                placeholder="Đáp án mong đợi"
                                className="rounded-xl mt-1"
                              />
                            </div>

                            {q.type === "mcq" && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                    Lựa chọn
                                  </Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addOption(qi)}
                                    className="text-xs h-6 text-blue-600"
                                  >
                                    + Thêm lựa chọn
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {(q.options || []).map((opt, oi) => (
                                    <div
                                      key={oi}
                                      className="flex items-center gap-2"
                                    >
                                      <input
                                        type="radio"
                                        name={`correct-${q.id}`}
                                        checked={opt.isCorrect}
                                        onChange={() => {
                                          setEditedQuestions((prev) => {
                                            const next = [...prev];
                                            const opts = (
                                              next[qi].options || []
                                            ).map((o, i) => ({
                                              ...o,
                                              isCorrect: i === oi,
                                            }));
                                            next[qi] = {
                                              ...next[qi],
                                              options: opts,
                                            };
                                            return next;
                                          });
                                        }}
                                        className="size-4"
                                      />
                                      <Input
                                        value={opt.text}
                                        onChange={(e) =>
                                          updateEditedOption(
                                            qi,
                                            oi,
                                            "text",
                                            e.target.value
                                          )
                                        }
                                        placeholder={`Lựa chọn ${oi + 1}`}
                                        className="rounded-xl flex-1 h-8 text-sm"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          removeOption(qi, oi)
                                        }
                                        className="text-red-400 hover:text-red-600 h-8 w-8 p-0"
                                      >
                                        <X className="size-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Giải thích
                              </Label>
                              <Textarea
                                value={q.explanation || ""}
                                onChange={(e) =>
                                  updateEditedQuestion(
                                    qi,
                                    "explanation",
                                    e.target.value
                                  )
                                }
                                placeholder="Giải thích đáp án"
                                rows={2}
                                className="rounded-xl mt-1 text-sm"
                              />
                            </div>
                          </div>
                        ) : (
                          /* View mode */
                          <div className="flex-1">
                            <p className="text-gray-900 font-medium">
                              {q.question}
                            </p>
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                              <span className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 font-medium">
                                {q.type === "mcq" ? "Trắc nghiệm" : "Tự luận"}
                              </span>
                              {q.difficulty && (
                                <span
                                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                                    difficultyColors[q.difficulty] ||
                                    "bg-gray-50"
                                  }`}
                                >
                                  {difficultyLabels[q.difficulty] ||
                                    q.difficulty}
                                </span>
                              )}
                              <span className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600 font-medium">
                                {q.score || 10} điểm
                              </span>
                              {q.expectedAnswer && (
                                <span className="text-xs text-gray-400">
                                  Đáp án: {q.expectedAnswer}
                                </span>
                              )}
                            </div>
                            {q.type === "mcq" &&
                              q.options &&
                              q.options.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                  {q.options.map((opt, oi) => (
                                    <span
                                      key={oi}
                                      className={`text-xs px-2.5 py-1 rounded-full border ${
                                        opt.isCorrect
                                          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                          : "bg-gray-50 border-gray-200 text-gray-500"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + oi)}. {opt.text}{" "}
                                      {opt.isCorrect ? "✓" : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            {q.explanation && (
                              <p className="text-xs text-gray-400 mt-2.5 italic">
                                💡 {q.explanation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              {editingQuestions && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-100 mt-6">
                  <Button
                    onClick={handleSaveQuestions}
                    disabled={savingQuestions}
                    className="gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="size-4" />
                    {savingQuestions ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelEditingQuestions}
                    disabled={savingQuestions}
                    className="rounded-xl"
                  >
                    <X className="size-4 mr-1" /> Huỷ
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submissions List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Bài nộp của học sinh ({submissions.length})
          </h2>
          <Link
            href={`${basePath}/assignments/${id}/submissions`}
            className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1"
          >
            Xem tất cả
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-16">
            <Users className="size-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">Chưa có học sinh nào nộp bài</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {submissions.map((sub) => {
              const isUngraded =
                sub.status === "SUBMITTED" && sub.score == null;
              const isReturned = sub.status === "RETURNED";
              const isGraded = sub.score != null;

              let rowAccent = "";
              if (isReturned)
                rowAccent = "border-l-2 border-l-amber-400 bg-amber-50/30";
              else if (isUngraded)
                rowAccent = "border-l-2 border-l-blue-400 bg-blue-50/30";
              else if (isGraded)
                rowAccent = "border-l-2 border-l-emerald-400";

              return (
                <div key={sub.id} className={rowAccent}>
                  <button
                    onClick={() =>
                      router.push(
                        `${basePath}/assignments/${id}/submissions/${sub.id}`
                      )
                    }
                    className="w-full px-8 py-5 flex items-center justify-between hover:bg-gray-50/30 text-left transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="size-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">
                        {sub.studentName?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sub.studentName}
                        </p>
                        <p className="text-sm text-gray-400">
                          {new Date(sub.submittedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {sub.score != null && (
                        <span className="inline-flex items-center justify-center size-10 rounded-full bg-emerald-50 text-emerald-600 font-bold text-sm">
                          {sub.score}
                        </span>
                      )}
                      {isUngraded && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                          <span className="size-2 rounded-full bg-blue-500 animate-pulse" />
                          Cần chấm
                        </span>
                      )}
                      {isReturned && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                          Cần sửa lại
                        </span>
                      )}
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          statusStyle[sub.status] || "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {statusLabel[sub.status] || sub.status}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grading Sheet Dialog */}
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

      {/* Publish Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Giao bài: {assignment.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* Class selection */}
            <div>
              <Label className="text-sm font-bold uppercase tracking-wider text-gray-500">
                Chọn lớp
              </Label>
              <Select
                value={publishClassId}
                onValueChange={(v) => handlePublishClassChange(v ?? "")}
              >
                <SelectTrigger className="rounded-xl mt-1.5 w-full">
                  <SelectValue placeholder="Chọn lớp học..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả các lớp</SelectItem>
                  {availableClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Student selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Chọn học sinh (
                  {publishStudentIds.length > 0
                    ? publishStudentIds.length
                    : "cả lớp"}
                  )
                </Label>
                {publishStudentIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPublishStudentIds([])}
                    className="text-xs h-6 text-gray-500"
                  >
                    Bỏ chọn tất cả
                  </Button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-0.5">
                {availableStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    {publishClassId
                      ? "Không có học sinh nào trong lớp này"
                      : "Chọn lớp để xem danh sách học sinh"}
                  </p>
                ) : (
                  availableStudents.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={publishStudentIds.includes(s.supabaseId)}
                        onChange={() =>
                          setPublishStudentIds((prev) =>
                            prev.includes(s.supabaseId)
                              ? prev.filter((id) => id !== s.supabaseId)
                              : [...prev, s.supabaseId]
                          )
                        }
                        className="size-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm">{s.fullName}</span>
                    </label>
                  ))
                )}
              </div>
              {publishStudentIds.length > 0 &&
                availableStudents.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Đã chọn {publishStudentIds.length}/
                    {availableStudents.length} học sinh
                  </p>
                )}
              {publishStudentIds.length === 0 &&
                availableStudents.length > 0 && (
                  <p className="text-xs text-amber-500 mt-1.5">
                    Để trống = giao cho tất cả học sinh trong lớp
                  </p>
                )}
            </div>

            {/* Summary */}
            <div className="p-4 bg-gray-50 rounded-2xl text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-semibold">Lớp:</span>{" "}
                {publishClassId
                  ? (availableClasses.find((c) => c.id === publishClassId)
                      ?.name || publishClassId)
                  : "Tất cả"}
              </p>
              <p>
                <span className="font-semibold">Số học sinh:</span>{" "}
                {publishStudentIds.length > 0
                  ? publishStudentIds.length
                  : "Cả lớp"}
              </p>
              <p>
                <span className="font-semibold">Số câu hỏi:</span>{" "}
                {questions.length}
              </p>
              <p>
                <span className="font-semibold">Tổng điểm:</span>{" "}
                {assignment.maxScore}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button
                onClick={handleConfirmPublish}
                disabled={publishing}
                className="gap-1.5 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <Send className="size-4" />
                {publishing ? "Đang giao..." : "Xác nhận giao bài"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setPublishDialogOpen(false)}
                disabled={publishing}
                className="flex-1 rounded-xl"
              >
                Huỷ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
