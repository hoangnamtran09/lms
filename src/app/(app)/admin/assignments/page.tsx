"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Trash2, Plus, FileText, Pencil, ClipboardList, BookOpen, Brain, Sparkles, Users, Loader2 } from "lucide-react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { api, ApiError, uploadFile } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";

interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount: number;
  createdAt: string;
  studentIds?: string;
}

interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
}

interface GeneratedQuestion {
  id: string;
  question: string;
  expectedAnswer?: string;
  score?: number;
  type?: string;
  difficulty?: string;
  options?: { text: string; isCorrect: boolean }[];
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

interface Subject {
  id: string;
  name: string;
}

interface Course {
  id: string;
  title: string;
  subjectId: string;
  sortOrder: number;
}

interface Lesson {
  id: string;
  title: string;
  courseId: string;
  sortOrder: number;
}

interface ClassItem {
  id: string;
  name: string;
}

interface WeaknessTopic {
  topic: string;
  totalErrors: number;
  studentCount: number;
  studentIds: string[];
}

type CreationMode = "lesson" | "weakness" | "manual";

export default function AdminAssignmentsPage({ basePath = "/admin" }: { basePath?: string }) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>("lesson");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit form
  const [editingAssignment, setEditingAssignment] = useState<AssignmentRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Manual mode
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Lesson mode
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [questionType, setQuestionType] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(5);

  // Weakness mode
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [topics, setTopics] = useState<WeaknessTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<WeaknessTopic | null>(null);

  // Generated questions (shared across AI modes)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState("");

  const getClassName = (classId: string) => {
    const c = classes.find((c) => c.id === classId);
    return c ? c.name : classId;
  };

  const fetchAssignments = () => {
    api<AssignmentRow[]>("/api/assignments")
      .then((data) => setAssignments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAssignments(); }, []);

  // Fetch students filtered by selected class
  useEffect(() => {
    const url = classId
      ? `/api/users?role=STUDENT&classId=${classId}`
      : "/api/users?role=STUDENT";
    api<StudentBrief[]>(url)
      .then((data) => {
        setSelectedStudentIds([]);
        setStudents(data || []);
      })
      .catch(() => { setSelectedStudentIds([]); setStudents([]); });
  }, [classId]);

  // Fetch subjects on mount
  useEffect(() => {
    api<Subject[]>("/api/subjects")
      .then((data) => setSubjects(data || []))
      .catch(() => {});
  }, []);

  // Fetch classes on mount
  useEffect(() => {
    api<ClassItem[]>("/api/classes")
      .then((data) => setClasses(data || []))
      .catch(() => {});
  }, []);

  // Fetch lessons — same logic as admin/courses page
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedSubjectId) {
      if (lessons.length) setLessons([]);
      if (selectedLessonId) setSelectedLessonId("");
      return;
    /* eslint-enable react-hooks/set-state-in-effect */
    }
    (async () => {
      setSelectedLessonId("");
      const courses = await api<Course[]>(`/api/courses?subjectId=${selectedSubjectId}`);
      const all: Lesson[] = [];
      for (const c of courses) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        all.push(...l);
      }
      all.sort((a, b) => {
        const na = parseInt((a.title.match(/\d+/) || [""])[0]) || 0;
        const nb = parseInt((b.title.match(/\d+/) || [""])[0]) || 0;
        return na - nb;
      });
      setLessons(all);
    })().catch(() => setLessons([]));
  }, [selectedSubjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch weakness topics when class changes
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!selectedClassId) {
      if (topics.length) setTopics([]);
      return;
    }
    setLoadingTopics(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    api<WeaknessTopic[]>(`/api/weaknesses/class-summary?classId=${selectedClassId}`)
      .then((data) => { setSelectedTopic(null); setTopics(data || []); })
      .catch(() => { setSelectedTopic(null); setTopics([]); })
      .finally(() => setLoadingTopics(false));
  }, [selectedClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Generate from lesson ----
  const handleGenerateFromLesson = async () => {
    if (!selectedLessonId) {
      setGenerateError("Vui lòng chọn bài học");
      return;
    }
    setGeneratingQuestions(true);
    setGenerateError(null);
    try {
      const result = await api<{
        questions: GeneratedQuestion[];
        lessonTitle: string;
        subjectName: string;
      }>("/api/ai/generate-assignment", {
        method: "POST",
        body: JSON.stringify({ lessonId: selectedLessonId, questionCount, questionType }),
      });
      setGeneratedQuestions(result.questions || []);
      setGeneratedTitle(`Bài tập: ${result.lessonTitle || "Bài học"}`);
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Lỗi tạo câu hỏi");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // ---- Generate remediation ----
  const handleGenerateRemediation = async () => {
    if (!selectedTopic) {
      setGenerateError("Vui lòng chọn chủ đề điểm yếu");
      return;
    }
    setGeneratingQuestions(true);
    setGenerateError(null);
    try {
      const result = await api<{
        assignmentId: string;
        title: string;
        questions: GeneratedQuestion[];
        assignedStudentCount: number;
      }>("/api/ai/generate-remediation-assignment", {
        method: "POST",
        body: JSON.stringify({
          classId: selectedClassId,
          topic: selectedTopic.topic,
        }),
      });
      setGeneratedQuestions(result.questions || []);
      setGeneratedTitle(result.title || `Khắc phục: ${selectedTopic.topic}`);
      // Store assignment ID so we don't create a duplicate
      sessionStorage.setItem("lastRemediationAssignmentId", result.assignmentId);
      setCreateError(null);
      alert(`Đã tạo bài tập và gán cho ${result.assignedStudentCount} học sinh.`);
      fetchAssignments();
      // Reset form
      setShowForm(false);
      resetForm();
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Lỗi tạo bài tập khắc phục");
    } finally {
      setGeneratingQuestions(false);
    }
  };

  // ---- Create manual assignment or save generated questions ----
  const handleCreate = async () => {
    if (!title.trim() && generatedQuestions.length === 0) {
      setCreateError("Vui lòng nhập tiêu đề bài tập");
      return;
    }
    setSubmitting(true);
    setCreateError(null);
    try {
      let attachmentUrl = "";
      if (selectedFile) {
        const uploadResult = await uploadFile("/api/assignments/upload", selectedFile);
        attachmentUrl = uploadResult.url;
      }
      const totalScore = generatedQuestions.length > 0
        ? generatedQuestions.reduce((s, q) => s + (q.score || 10), 0)
        : maxScore;

      const body: Record<string, unknown> = {
        title: title.trim() || generatedTitle || "Bài tập mới",
        description: description.trim(),
        rubric: rubric.trim(),
        maxScore: totalScore,
        classId: classId.trim(),
        attachmentUrl,
        studentIds: selectedStudentIds.length > 0 ? JSON.stringify(selectedStudentIds) : "",
      };
      if (generatedQuestions.length > 0) {
        body.questions = JSON.stringify(generatedQuestions);
      }
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      });
      resetForm();
      setShowForm(false);
      fetchAssignments();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Tạo bài tập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRubric("");
    setMaxScore(100);
    setClassId("");
    setDueDate("");
    setSelectedFile(null);
    setSelectedStudentIds([]);
    setGeneratedQuestions([]);
    setGeneratedTitle("");
    setGenerateError(null);
    setSelectedSubjectId("");
    setSelectedLessonId("");
    setSelectedClassId("");
    setSelectedTopic(null);
    setTopics([]);
  };

  const handleEditClick = async (a: AssignmentRow) => {
    setEditingAssignment(a);
    try {
      const full = await api<Record<string, unknown>>(`/api/assignments/${a.id}`);
      setEditForm({
        title: (full.title as string) || "",
        description: (full.description as string) || "",
        rubric: (full.rubric as string) || "",
        maxScore: String((full.maxScore as number) ?? 100),
        dueDate: full.dueDate ? new Date(full.dueDate as string).toISOString().slice(0, 16) : "",
        allowResubmit: full.allowResubmit ? "true" : "false",
        subjectId: (full.subjectId as string) || "",
        classId: (full.classId as string) || "",
      });
      setEditError(null);
    } catch {
      setEditError("Không thể tải thông tin bài tập");
    }
  };

  const handleEditSave = async () => {
    if (!editingAssignment) return;
    if (!editForm.title?.trim()) {
      setEditError("Tiêu đề không được để trống");
      return;
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const body: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        rubric: editForm.rubric.trim(),
        maxScore: parseInt(editForm.maxScore || "100"),
        allowResubmit: editForm.allowResubmit === "true",
        subjectId: editForm.subjectId || "",
        classId: editForm.classId || "",
      };
      body.dueDate = editForm.dueDate
        ? new Date(editForm.dueDate).toISOString()
        : new Date().toISOString();
      await api(`/api/assignments/${editingAssignment.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditingAssignment(null);
      setEditForm({});
      fetchAssignments();
    } catch (e: unknown) {
      setEditError(e instanceof ApiError ? e.message : "Cập nhật thất bại");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá bài tập này? Tất cả bài nộp liên quan sẽ bị mất.")) return;
    try {
      await api(`/api/assignments/${id}`, { method: "DELETE" });
      fetchAssignments();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const updateQuestion = (index: number, field: keyof GeneratedQuestion, value: string | number) => {
    setGeneratedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissionCount, 0);
  const pendingCount = assignments.filter((a) => a.submissionCount > 0).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-10 w-40" />
        <Skeleton delay={200} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
        <div>
          <nav className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
            <Link href={basePath} className="hover:text-primary transition-colors">
              Dashboard
            </Link>
            <span className="text-gray-300">›</span>
            <span className="text-primary font-bold">Bài tập</span>
          </nav>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">
            Quản lý Bài tập
          </h2>
          <p className="text-sm text-gray-500 mt-1">{assignments.length} bài tập · {totalSubmissions} bài nộp</p>
        </div>
        <Link href="/teacher/assignments/create">
          <Button className="gap-2 rounded-2xl shadow-lg shadow-primary/20 font-bold active:scale-[0.98] transition-transform px-6 py-3">
            <Plus className="size-5" />
            Tạo bài tập
          </Button>
        </Link>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-blue-100">
                <ClipboardList className="size-4 text-blue-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tạo bài tập mới</h2>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{createError}</div>
            )}

            {/* Mode tabs */}
            <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
              {([
                { key: "lesson", label: "Từ bài học", icon: BookOpen },
                { key: "weakness", label: "Khắc phục điểm yếu", icon: Brain },
                { key: "manual", label: "Thủ công", icon: FileText },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setCreationMode(key as CreationMode);
                    setGenerateError(null);
                    setGeneratedQuestions([]);
                    setGeneratedTitle("");
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    creationMode === key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* === MODE: Từ bài học === */}
            {creationMode === "lesson" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Chọn bài học, AI sẽ tự động tạo câu hỏi từ nội dung bài học.
                </p>

                {/* Cascading dropdowns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Môn học</Label>
                    <Select value={selectedSubjectId} onValueChange={(v) => setSelectedSubjectId(v ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn môn...">
                          {(value: string) => subjects.find((s) => s.id === value)?.name || ""}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Bài học</Label>
                    <Select value={selectedLessonId} onValueChange={(v) => setSelectedLessonId(v ?? "")} disabled={!selectedSubjectId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={selectedSubjectId ? "Chọn bài học..." : "Chọn môn trước"}>
                        {(value: string) => lessons.find((l) => l.id === value)?.title || ""}
                      </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {lessons.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Question config */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Loại câu hỏi</Label>
                    <Select value={questionType} onValueChange={(v) => setQuestionType(v ?? "mixed")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => ({ mixed: "Hỗn hợp", mcq: "Trắc nghiệm", open_ended: "Tự luận" }[value] || "")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Hỗn hợp</SelectItem>
                        <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                        <SelectItem value="open_ended">Tự luận</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1 block">Số câu hỏi</Label>
                    <Select value={String(questionCount)} onValueChange={(v) => setQuestionCount(Number(v))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n} câu</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleGenerateFromLesson}
                      disabled={!selectedLessonId || generatingQuestions}
                      className="gap-2 w-full"
                    >
                      {generatingQuestions ? (
                        <><Loader2 className="size-4 animate-spin" /> Đang tạo...</>
                      ) : (
                        <><Sparkles className="size-4" /> Tạo bằng AI</>
                      )}
                    </Button>
                  </div>
                </div>

                {generateError && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">{generateError}</div>
                )}

                {/* Generated questions preview */}
                {generatedQuestions.length > 0 && (
                  <QuestionPreview
                    questions={generatedQuestions}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                    title={generatedTitle}
                    onTitleChange={setGeneratedTitle}
                  />
                )}
              </div>
            )}

            {/* === MODE: Khắc phục điểm yếu === */}
            {creationMode === "weakness" && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Chọn lớp, xem các chủ đề học sinh đang yếu, sau đó AI sẽ tạo bài tập khắc phục và tự động gán cho học sinh.
                </p>

                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Chọn lớp</Label>
                  <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v ?? "")}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Chọn lớp...">
                        {(value: string) => classes.find((c) => c.id === value)?.name || ""}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Weakness topics */}
                {selectedClassId && (
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">
                      Chủ đề điểm yếu ({topics.length})
                    </Label>
                    {loadingTopics ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                        <Loader2 className="size-4 animate-spin" />
                        Đang tải dữ liệu điểm yếu...
                      </div>
                    ) : topics.length === 0 ? (
                      <div className="p-6 text-center bg-gray-50 rounded-lg">
                        <Brain className="size-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Lớp này không có điểm yếu nào</p>
                        <p className="text-xs text-gray-400 mt-1">Tất cả học sinh đều đang học tốt</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Chủ đề</TableHead>
                            <TableHead className="text-center">Số HS yếu</TableHead>
                            <TableHead className="text-center">Tổng lỗi</TableHead>
                            <TableHead className="w-24"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topics.map((t) => (
                            <TableRow key={t.topic} className={selectedTopic?.topic === t.topic ? "bg-blue-50" : ""}>
                              <TableCell className="font-medium">{t.topic}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">{t.studentCount}</Badge>
                              </TableCell>
                              <TableCell className="text-center text-red-500 font-medium">{t.totalErrors}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={selectedTopic?.topic === t.topic ? "default" : "outline"}
                                  onClick={() => setSelectedTopic(t)}
                                >
                                  Chọn
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {selectedTopic && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Chủ đề đã chọn:</span>{" "}
                      <Badge variant="default" className="ml-1">{selectedTopic.topic}</Badge>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedTopic.studentCount} học sinh · {selectedTopic.totalErrors} lỗi
                    </p>
                    <Button
                      onClick={handleGenerateRemediation}
                      disabled={generatingQuestions}
                      className="gap-2 mt-3"
                    >
                      {generatingQuestions ? (
                        <><Loader2 className="size-4 animate-spin" /> Đang tạo...</>
                      ) : (
                        <><Sparkles className="size-4" /> Tạo bài tập khắc phục & gán tự động</>
                      )}
                    </Button>
                  </div>
                )}

                {generateError && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">{generateError}</div>
                )}
              </div>
            )}

            {/* === MODE: Thủ công === */}
            {creationMode === "manual" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Tiêu đề</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Nhập tiêu đề bài tập"
                    />
                  </div>
                  <div>
                    <Label htmlFor="desc">Mô tả / Câu hỏi</Label>
                    <Textarea
                      id="desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Nhập nội dung câu hỏi hoặc yêu cầu bài tập"
                      rows={5}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rubric">Tiêu chí chấm điểm</Label>
                    <Textarea
                      id="rubric"
                      value={rubric}
                      onChange={(e) => setRubric(e.target.value)}
                      placeholder="VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="score">Điểm tối đa</Label>
                      <Input
                        id="score"
                        type="number"
                        value={maxScore}
                        onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
                        min={1}
                        max={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="class">Lớp (tuỳ chọn)</Label>
                      <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                        <SelectTrigger id="class" className="w-full">
                          <SelectValue placeholder="Chọn lớp...">
                            {(value: string) => value ? classes.find((c) => c.id === value)?.name || "" : "Tất cả"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tất cả</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
              </div>
              <div>
                    <Label htmlFor="due">Hạn nộp (tuỳ chọn)</Label>
                    <Input
                      id="due"
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="file">Tệp đính kèm (PDF, tuỳ chọn)</Label>
                    {selectedFile ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-600 truncate flex-1">{selectedFile.name}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          className="text-red-500 hover:text-red-700 shrink-0"
                        >
                          Gỡ
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="file"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Học sinh nhận bài (để trống = cả lớp)</Label>
                    {students.length === 0 ? (
                      <p className="text-sm text-gray-400 mt-1">Đang tải danh sách học sinh...</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-0.5 mt-1">
                        {students.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.supabaseId)}
                              onChange={() => {
                                setSelectedStudentIds((prev) =>
                                  prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId]
                                );
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{s.fullName}</span>
                            <span className="text-xs text-gray-400 ml-auto">{s.username}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedStudentIds.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Shared: Generated questions preview & form actions for lesson/manual modes */}
            {creationMode !== "weakness" && generatedQuestions.length > 0 && (
              <QuestionPreview
                questions={generatedQuestions}
                updateQuestion={updateQuestion}
                removeQuestion={removeQuestion}
                title={generatedTitle}
                onTitleChange={setGeneratedTitle}
              />
            )}

            {/* Form actions (lesson mode only — manual has its own) */}
            {creationMode === "lesson" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="class-manual">Lớp (tuỳ chọn)</Label>
                      <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                        <SelectTrigger id="class-manual" className="w-full">
                          <SelectValue placeholder="Chọn lớp...">
                            {(value: string) => value ? classes.find((c) => c.id === value)?.name || "" : "Tất cả"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tất cả</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="due-manual">Hạn nộp (tuỳ chọn)</Label>
                      <Input
                        id="due-manual"
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Học sinh nhận bài (để trống = cả lớp)</Label>
                    {students.length === 0 ? (
                      <p className="text-sm text-gray-400 mt-1">Đang tải danh sách học sinh...</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-0.5 mt-1">
                        {students.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.includes(s.supabaseId)}
                              onChange={() => {
                                setSelectedStudentIds((prev) =>
                                  prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId]
                                );
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">{s.fullName}</span>
                            <span className="text-xs text-gray-400 ml-auto">{s.username}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedStudentIds.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Generated title for AI modes */}
                  {generatedQuestions.length > 0 && creationMode === "lesson" && (
                    <div>
                      <Label htmlFor="gen-title">Tiêu đề bài tập</Label>
                      <Input
                        id="gen-title"
                        value={generatedTitle}
                        onChange={(e) => setGeneratedTitle(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="rubric-gen">Tiêu chí chấm điểm</Label>
                    <Textarea
                      id="rubric-gen"
                      value={rubric}
                      onChange={(e) => setRubric(e.target.value)}
                      placeholder="VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleCreate} disabled={submitting} className="gap-2">
                      <Plus className="size-4" />
                      {submitting ? "Đang tạo..." : "Lưu bài tập"}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Manual mode own actions */}
            {creationMode === "manual" && (
              <div className="flex gap-3 pt-2 mt-6">
                <Button onClick={handleCreate} disabled={submitting} className="gap-2">
                  <Plus className="size-4" />
                  {submitting ? "Đang tạo..." : "Tạo bài tập"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  Huỷ
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats mini cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100">
              <ClipboardList className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng bài tập</p>
              <p className="text-xl font-bold text-gray-900">{assignments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-emerald-100">
              <FileText className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tổng bài nộp</p>
              <p className="text-xl font-bold text-gray-900">{totalSubmissions}</p>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-amber-100">
              <Users className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Đã có bài nộp</p>
              <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Assignments Card List */}
      <div className="grid grid-cols-1 gap-4">
        {assignments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <FileText className="size-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400">Chưa có bài tập nào</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => setShowForm(true)}>
              <Plus className="size-3 mr-1" /> Tạo bài tập đầu tiên
            </Button>
          </div>
        ) : (
          assignments.map((a) => {
            const className = getClassName(a.classId);
            const totalAssigned = (() => {
              if (a.studentIds) {
                try { const ids = JSON.parse(a.studentIds); if (Array.isArray(ids) && ids.length > 0) return ids.length; } catch {}
              }
              return 0; // 0 = unknown (whole class)
            })();
            const progressPct = totalAssigned > 0
              ? Math.min(Math.round((a.submissionCount / totalAssigned) * 100), 100)
              : 0;
            const showProgressBar = totalAssigned > 0;
            return (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col lg:flex-row lg:items-center gap-6 hover:shadow-lg transition-all group"
              >
                {/* Icon */}
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <FileText className="size-7" />
                </div>
                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{a.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {className && (
                      <Badge variant="outline" className="text-xs">{className}</Badge>
                    )}
                    <span className="text-sm text-gray-500">
                      Điểm tối đa: <span className="font-semibold">{a.maxScore}</span>
                    </span>
                    {a.dueDate && (
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        · Hạn: {new Date(a.dueDate).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                  </div>
                  {/* Progress */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 max-w-[200px] bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          showProgressBar ? "bg-primary" : a.submissionCount > 0 ? "bg-emerald-400" : "bg-gray-200"
                        }`}
                        style={{ width: showProgressBar ? `${Math.max(progressPct, 2)}%` : a.submissionCount > 0 ? "100%" : "0%" }}
                      />
                    </div>
                    <Badge variant={a.submissionCount > 0 ? "default" : "outline"} className="text-xs">
                      {a.submissionCount} bài nộp
                    </Badge>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleEditClick(a)} className="text-primary hover:bg-primary/10 rounded-xl">
                    <Pencil className="size-4" />
                  </Button>
                  <Link href={`${basePath}/assignments/${a.id}`}>
                    <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-xl">
                      <Eye className="size-4" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="text-red-500 hover:bg-red-50 rounded-xl">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit dialog — Stitch style */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => { if (!open) { setEditingAssignment(null); setEditForm({}); setEditError(null); } }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl p-0 gap-0 overflow-hidden rounded-2xl [&>button]:top-4 [&>button]:right-4">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-xl font-bold text-gray-900">Chỉnh sửa bài tập</h3>
          </div>
          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
            {editError && <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{editError}</div>}

            {/* Tên bài tập */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Tên bài tập</label>
              <input
                type="text"
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                placeholder="Nhập tên bài tập"
              />
            </div>

            {/* Môn học + Lớp học */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Môn học</label>
                <select
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                  value={editForm.subjectId || ""}
                  onChange={(e) => setEditForm({ ...editForm, subjectId: e.target.value })}
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Lớp học</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {editForm.classId && classes.find((c) => c.id === editForm.classId) ? (
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      {classes.find((c) => c.id === editForm.classId)?.name}
                      <button type="button" onClick={() => setEditForm({ ...editForm, classId: "" })} className="hover:text-red-500 transition-colors ml-0.5">
                        <MaterialIcon name="close" className="text-sm" />
                      </button>
                    </span>
                  ) : (
                    <select
                      className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm flex-1"
                      value=""
                      onChange={(e) => setEditForm({ ...editForm, classId: e.target.value })}
                    >
                      <option value="">Chọn lớp học...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Hạn nộp */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Hạn nộp</label>
              <div className="relative">
                <MaterialIcon name="calendar_today" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl" />
                <input
                  type="datetime-local"
                  value={editForm.dueDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                />
              </div>
            </div>

            {/* Mô tả */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Mô tả bài tập</label>
              <textarea
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-none"
                placeholder="Nhập mô tả bài tập..."
              />
            </div>

            {/* Điểm tối đa */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Điểm tối đa</label>
              <input
                type="number"
                value={editForm.maxScore || "100"}
                onChange={(e) => setEditForm({ ...editForm, maxScore: e.target.value })}
                min={1}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              />
            </div>

            {/* Toggle: Cho phép nộp muộn */}
            <label className="flex items-center justify-between cursor-pointer pt-2">
              <span className="text-base font-semibold text-gray-900">Cho phép nộp muộn</span>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={editForm.allowResubmit === "true"}
                  onChange={(e) => setEditForm({ ...editForm, allowResubmit: String(e.target.checked) })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
              </div>
            </label>
          </div>
          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setEditingAssignment(null); setEditForm({}); setEditError(null); }}
              className="px-6 py-2.5 border border-gray-300 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-all"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={savingEdit}
              className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Shared question preview component
function QuestionPreview({
  questions,
  updateQuestion,
  removeQuestion,
  title,
  onTitleChange,
}: {
  questions: GeneratedQuestion[];
  updateQuestion: (index: number, field: keyof GeneratedQuestion, value: string | number) => void;
  removeQuestion: (index: number) => void;
  title?: string;
  onTitleChange?: (t: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="border-t pt-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-5 text-purple-600" />
        <h3 className="font-bold text-gray-900">
          {questions.length} câu hỏi đã tạo
        </h3>
        <span className="text-sm text-gray-500">
          — Chỉnh sửa nếu cần trước khi lưu
        </span>
      </div>
      {title !== undefined && onTitleChange && (
        <div className="mb-4">
          <Label htmlFor="gen-title-preview">Tiêu đề bài tập</Label>
          <Input
            id="gen-title-preview"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="max-w-md"
          />
        </div>
      )}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {questions.map((q, i) => (
          <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-purple-600">Câu {i + 1}</span>
                {q.type && (
                  <Badge variant="outline" className="text-xs">
                    {q.type === "mcq" ? "Trắc nghiệm" : q.type === "short_answer" ? "Trả lời ngắn" : "Tự luận"}
                  </Badge>
                )}
                {q.difficulty && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                    {difficultyLabels[q.difficulty] || q.difficulty}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(i)}
                className="text-red-400 hover:text-red-600 h-6 px-2"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
              <div className="space-y-3">
              <div>
                <Label className="text-xs text-gray-500">Nội dung câu hỏi</Label>
                <Textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(i, "question", e.target.value)}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Mức độ</Label>
                  <select
                    value={q.difficulty || ""}
                    onChange={(e) => updateQuestion(i, "difficulty", e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                    <option value="">Chọn mức độ</option>
                    <option value="nhan_biet">Nhận biết</option>
                    <option value="thong_hieu">Thông hiểu</option>
                    <option value="van_dung">Vận dụng</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Đáp án mong đợi</Label>
                  <Input
                    value={q.expectedAnswer || ""}
                    onChange={(e) => updateQuestion(i, "expectedAnswer", e.target.value)}
                    placeholder="Nhập đáp án đúng..."
                    className="mt-1"
                  />
                </div>
                <div className="col-span-1">
                  <Label className="text-xs text-gray-500">Điểm</Label>
                  <Input
                    type="number"
                    value={q.score || 10}
                    onChange={(e) => updateQuestion(i, "score", parseInt(e.target.value) || 0)}
                    min={1}
                    max={100}
                    className="mt-1"
                  />
                </div>
              </div>
              {q.explanation && (
                <div>
                  <Label className="text-xs text-gray-500">Giải thích</Label>
                  <p className="text-sm text-gray-600 mt-1">{q.explanation}</p>
                </div>
              )}
              {/* Show options for MCQ */}
              {q.options && q.options.length > 0 && (
                <div>
                  <Label className="text-xs text-gray-500">Đáp án</Label>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {q.options.map((opt, j) => (
                      <span key={j} className={`text-sm px-2 py-1 rounded ${opt.isCorrect ? "bg-emerald-100 text-emerald-700 font-medium" : "bg-gray-100 text-gray-600"}`}>
                        {opt.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        <span>Tổng điểm:</span>
        <Badge variant="default">
          {questions.reduce((s, q) => s + (q.score || 10), 0)}
        </Badge>
        <span className="mx-2">·</span>
        <span>Phân bố:</span>
        {["nhan_biet", "thong_hieu", "van_dung"].map((d) => {
          const count = questions.filter((q) => q.difficulty === d).length;
          if (count === 0) return null;
          return (
            <span key={d} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${difficultyColors[d] || ""}`}>
              {difficultyLabels[d]}: {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
