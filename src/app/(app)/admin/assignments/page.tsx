"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Trash2, Plus, ChevronUp, ClipboardList, FileText, Users, Loader2, Sparkles, BookOpen, Brain, Pencil } from "lucide-react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle,
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

export default function AdminAssignmentsPage() {
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
    if (!selectedSubjectId) {
      if (lessons.length) setLessons([]);
      if (selectedLessonId) setSelectedLessonId("");
      return;
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
  }, [selectedSubjectId]);

  // Fetch weakness topics when class changes
  useEffect(() => {
    if (!selectedClassId) { if (topics.length) setTopics([]); return; }
    setLoadingTopics(true);
    api<WeaknessTopic[]>(`/api/weaknesses/class-summary?classId=${selectedClassId}`)
      .then((data) => { setSelectedTopic(null); setTopics(data || []); })
      .catch(() => { setSelectedTopic(null); setTopics([]); })
      .finally(() => setLoadingTopics(false));
  }, [selectedClassId]);

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
      };
      if (editForm.dueDate) {
        body.dueDate = new Date(editForm.dueDate).toISOString();
      } else {
        body.dueDate = null;
      }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">{assignments.length} bài tập · {totalSubmissions} bài nộp</p>
        </div>
        <Button onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }} className="gap-2">
          {showForm ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Thu gọn" : "Tạo bài tập"}
        </Button>
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

      {/* Assignments table */}
      <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="text-center">Điểm tối đa</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead className="text-center">Bài nộp</TableHead>
                <TableHead className="w-28"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <ClipboardList className="size-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400">Chưa có bài tập nào</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                      <Plus className="size-3 mr-1" /> Tạo bài tập đầu tiên
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-gray-900">{a.title}</TableCell>
                    <TableCell>
                      {a.classId ? (
                        <Badge variant="outline" className="text-xs">{a.classId}</Badge>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-gray-500">{a.maxScore}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {a.dueDate ? new Date(a.dueDate).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={a.submissionCount > 0 ? "default" : "outline"} className="text-xs">
                        {a.submissionCount}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(a)}>
                          <Pencil className="size-3" />
                        </Button>
                        <Link href={`/admin/assignments/${a.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="size-3" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)}
                          className="text-red-500 hover:text-red-700">
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingAssignment} onOpenChange={(open) => { if (!open) { setEditingAssignment(null); setEditForm({}); setEditError(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAssignment ? `Sửa: ${editingAssignment.title}` : "Sửa bài tập"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {editError && <div className="p-3 bg-red-50 rounded-lg text-sm text-red-600">{editError}</div>}
            <div>
              <Label htmlFor="edit-title">Tiêu đề</Label>
              <Input
                id="edit-title"
                value={editForm.title || ""}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-desc">Mô tả</Label>
              <Textarea
                id="edit-desc"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-rubric">Tiêu chí chấm điểm</Label>
              <Textarea
                id="edit-rubric"
                value={editForm.rubric || ""}
                onChange={(e) => setEditForm({ ...editForm, rubric: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-score">Điểm tối đa</Label>
                <Input
                  id="edit-score"
                  type="number"
                  value={editForm.maxScore || "100"}
                  onChange={(e) => setEditForm({ ...editForm, maxScore: e.target.value })}
                  min={1}
                />
              </div>
              <div>
                <Label htmlFor="edit-due">Hạn nộp</Label>
                <Input
                  id="edit-due"
                  type="datetime-local"
                  value={editForm.dueDate || ""}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-resubmit"
                checked={editForm.allowResubmit === "true"}
                onChange={(e) => setEditForm({ ...editForm, allowResubmit: String(e.target.checked) })}
                className="size-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-resubmit" className="cursor-pointer">Cho phép nộp lại</Label>
            </div>
            <Button onClick={handleEditSave} disabled={savingEdit} className="w-full">
              {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
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
