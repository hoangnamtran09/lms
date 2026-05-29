"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, Sparkles, BookOpen, Brain, FileText, ChevronRight, CheckCircle2 } from "lucide-react";
import { api, uploadFile, fetchList } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import QuestionPreview from "../components/QuestionPreview";
import MatrixStep from "./_components/MatrixStep";
import GeneratingOverlay from "./_components/GeneratingOverlay";
import { TestMatrix, computeTotals } from "@/lib/test-matrix";

// ---- Types ----
interface StudentBrief { id: string; supabaseId: string; fullName: string; username: string; }
interface GeneratedQuestion { id: string; question: string; expectedAnswer?: string; score?: number; type?: string; topic?: string; difficulty?: string; options?: { text: string; isCorrect: boolean }[]; explanation?: string; }
interface Subject { id: string; name: string; }
interface Course { id: string; title: string; subjectId: string; sortOrder: number; }
interface Lesson { id: string; title: string; courseId: string; sortOrder: number; }
interface ClassItem { id: string; name: string; }
interface WeaknessTopic { topic: string; totalErrors: number; studentCount: number; studentIds: string[]; }

type CreationMode = "lesson" | "weakness" | "manual";

const MODES = [
  {
    key: "lesson" as const, label: "Từ bài học",
    desc: "AI tạo câu hỏi từ nội dung bài học có sẵn. Phù hợp khi bạn muốn kiểm tra kiến thức sau mỗi bài giảng.",
    icon: BookOpen, cta: "Bắt đầu",
    gradient: "from-blue-50 to-indigo-50",
    border: "border-blue-200 hover:border-blue-400",
    activeBorder: "border-blue-500",
    iconBg: "bg-blue-100 text-blue-600",
    textColor: "text-blue-700",
    accent: "bg-blue-400/10",
  },
  {
    key: "weakness" as const, label: "Khắc phục điểm yếu",
    desc: "AI phân tích lỗi sai của lớp và tạo bài tập nhắm đúng chủ đề học sinh đang yếu. Tự động gán cho những em cần luyện tập.",
    icon: Brain, cta: "Phân tích AI",
    gradient: "from-pink-50 to-rose-50",
    border: "border-pink-200 hover:border-pink-400",
    activeBorder: "border-pink-500",
    iconBg: "bg-pink-100 text-pink-600",
    textColor: "text-pink-700",
    accent: "bg-pink-400/10",
  },
  {
    key: "manual" as const, label: "Thủ công",
    desc: "Tự nhập câu hỏi, đính kèm file PDF, chọn học sinh cụ thể. Phù hợp khi bạn đã có sẵn đề bài.",
    icon: FileText, cta: "Tạo thủ công",
    gradient: "from-emerald-50 to-teal-50",
    border: "border-emerald-200 hover:border-emerald-400",
    activeBorder: "border-emerald-500",
    iconBg: "bg-emerald-100 text-emerald-600",
    textColor: "text-emerald-700",
    accent: "bg-emerald-400/10",
  },
];

export default function CreateAssignmentPage() {
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Shared data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentBrief[]>([]);

  // Lesson mode
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [questionType, setQuestionType] = useState("mixed");
  const [questionCount, setQuestionCount] = useState(5);
  const [wizardStep, setWizardStep] = useState<"config" | "matrix" | "generate">("config");
  const [testMatrix, setTestMatrix] = useState<TestMatrix | null>(null);

  // Weakness mode
  const [selectedClassId, setSelectedClassId] = useState("");
  const [topics, setTopics] = useState<WeaknessTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<WeaknessTopic | null>(null);

  // Manual mode
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [maxScore, setMaxScore] = useState(100);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // AI-generated
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState("");

  // Load shared data
  useEffect(() => {
    api<Subject[]>("/api/subjects").then((d) => setSubjects(d || [])).catch(() => {});
    api<ClassItem[]>("/api/classes").then((d) => setClasses(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const url = classId ? `/api/users?role=STUDENT&classId=${classId}` : "/api/users?role=STUDENT";
    api<StudentBrief[]>(url).then((d) => { setSelectedStudentIds([]); setStudents(d || []); }).catch(() => { setSelectedStudentIds([]); setStudents([]); });
  }, [classId]);

  // Load lessons when subject changes
  useEffect(() => {
    if (!selectedSubjectId) { setLessons([]); setSelectedLessonId(""); return; }
    setSelectedLessonId("");
    (async () => {
      const courses = await fetchList<Course>(`/api/courses?subjectId=${selectedSubjectId}`);
      const all: Lesson[] = [];
      for (const c of courses) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        all.push(...l);
      }
      all.sort((a, b) => { const na = parseInt((a.title.match(/\d+/) || [""])[0]) || 0; const nb = parseInt((b.title.match(/\d+/) || [""])[0]) || 0; return na - nb; });
      setLessons(all);
    })().catch(() => setLessons([]));
  }, [selectedSubjectId]);

  // Load weakness topics
  useEffect(() => {
    if (!selectedClassId) { setTopics([]); return; }
    setLoadingTopics(true);
    api<WeaknessTopic[]>(`/api/weaknesses/class-summary?classId=${selectedClassId}`)
      .then((d) => { setSelectedTopic(null); setTopics(d || []); })
      .catch(() => { setSelectedTopic(null); setTopics([]); })
      .finally(() => setLoadingTopics(false));
  }, [selectedClassId]);

  const switchMode = (mode: CreationMode) => {
    if (mode === creationMode) return;
    setCreationMode(mode);
    setCreateError(null); setSuccessMsg(null);
    setGeneratedQuestions([]); setGeneratedTitle(""); setGenerateError(null);
    setTitle(""); setDescription(""); setRubric(""); setMaxScore(100);
    setClassId(""); setDueDate(""); setSelectedFile(null); setSelectedStudentIds([]);
    setSelectedSubjectId(""); setSelectedLessonId("");
    setSelectedClassId(""); setSelectedTopic(null); setTopics([]);
    setWizardStep("config"); setTestMatrix(null);
  };

  const handleGenerateFromLesson = async () => {
    if (!selectedLessonId) { setGenerateError("Vui lòng chọn bài học"); return; }
    setGeneratingQuestions(true); setGenerateError(null);
    try {
      const body: Record<string, unknown> = { lessonId: selectedLessonId, questionCount, questionType };
      if (testMatrix) body.matrix = testMatrix;
      const result = await api<{ questions: GeneratedQuestion[]; lessonTitle: string; subjectName: string }>(
        "/api/ai/generate-assignment", { method: "POST", body: JSON.stringify(body), timeout: 120000 }
      );
      setGeneratedQuestions(result.questions || []);
      setGeneratedTitle(`Bài tập: ${result.lessonTitle || "Bài học"}`);
      setWizardStep("generate");
      saveToQuestionBank(result.questions || []);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setGenerateError("Yêu cầu tạo câu hỏi đã hết thời gian chờ (120 giây). Vui lòng thử lại với ít câu hỏi hơn.");
      } else {
        setGenerateError(e instanceof Error ? e.message : "Lỗi tạo câu hỏi");
      }
    }
    finally { setGeneratingQuestions(false); }
  };

  const handleGenerateWithMatrix = async (matrix: TestMatrix) => {
    setTestMatrix(matrix);
    setGeneratingQuestions(true); setGenerateError(null);
    try {
      const totalQuestions = computeTotals(matrix).grandTotal.questionCount;
      // Derive question type from matrix format: tnkq→mcq, tu_luan→open_ended, ket_hop→mixed
      const formatToType: Record<string, string> = { tnkq: "mcq", tu_luan: "open_ended", ket_hop: "mixed" };
      const derivedType = formatToType[matrix.format] || "mixed";
      const body: Record<string, unknown> = { lessonId: selectedLessonId, questionCount: totalQuestions, questionType: derivedType, matrix };
      const result = await api<{ questions: GeneratedQuestion[]; lessonTitle: string; subjectName: string }>(
        "/api/ai/generate-assignment", { method: "POST", body: JSON.stringify(body), timeout: 120000 }
      );
      setGeneratedQuestions(result.questions || []);
      setGeneratedTitle(`Bài tập: ${result.lessonTitle || "Bài học"}`);
      setWizardStep("generate");
      saveToQuestionBank(result.questions || []);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setGenerateError("Yêu cầu tạo câu hỏi đã hết thời gian chờ (120 giây). Vui lòng thử lại với ít câu hỏi hơn.");
      } else {
        setGenerateError(e instanceof Error ? e.message : "Lỗi tạo câu hỏi");
      }
    }
    finally { setGeneratingQuestions(false); }
  };

  const saveToQuestionBank = (questions: GeneratedQuestion[]) => {
    if (questions.length === 0) return;
    const items = questions.map((q) => ({
      question: q.question || "",
      answer: q.expectedAnswer || "",
      topic: q.topic || "",
      cognitiveLevel: q.difficulty || "",
      questionType: q.type === "mcq" ? "mcq" : "open_ended",
      options: q.options ? JSON.stringify(q.options) : "",
      explanation: q.explanation || "",
      score: q.score || 1,
    }));
    api("/api/question-bank/batch", { method: "POST", body: JSON.stringify(items) }).catch(() => {});
  };

  const handleGenerateRemediation = async () => {
    if (!selectedTopic) { setGenerateError("Vui lòng chọn chủ đề điểm yếu"); return; }
    setGeneratingQuestions(true); setGenerateError(null);
    try {
      const result = await api<{ assignmentId: string; title: string; questions: GeneratedQuestion[]; assignedStudentCount: number }>(
        "/api/ai/generate-remediation-assignment", { method: "POST", body: JSON.stringify({ classId: selectedClassId, topic: selectedTopic.topic }) }
      );
      sessionStorage.setItem("lastRemediationAssignmentId", result.assignmentId);
      setSuccessMsg(`Đã tạo bài tập và gán cho ${result.assignedStudentCount} học sinh.`);
      resetForm(); setCreationMode(null);
    } catch (e: unknown) { setGenerateError(e instanceof Error ? e.message : "Lỗi tạo bài tập khắc phục"); }
    finally { setGeneratingQuestions(false); }
  };

  const handleCreate = async () => {
    if (!title.trim() && generatedQuestions.length === 0) { setCreateError("Vui lòng nhập tiêu đề bài tập"); return; }
    setSubmitting(true); setCreateError(null);
    try {
      let attachmentUrl = "";
      if (selectedFile) { const uploadResult = await uploadFile("/api/assignments/upload", selectedFile); attachmentUrl = uploadResult.url; }
      const totalScore = generatedQuestions.length > 0 ? generatedQuestions.reduce((s, q) => s + (q.score || 10), 0) : maxScore;
      const body: Record<string, unknown> = {
        title: title.trim() || generatedTitle || "Bài tập nháp", description: description.trim(),
        rubric: rubric.trim(), maxScore: totalScore, classId: classId.trim(), attachmentUrl,
        studentIds: selectedStudentIds.length > 0 ? JSON.stringify(selectedStudentIds) : "",
        status: "DRAFT",
      };
      if (generatedQuestions.length > 0) body.questions = JSON.stringify(generatedQuestions);
      if (testMatrix) body.matrixMetadata = JSON.stringify(testMatrix);
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api("/api/assignments", { method: "POST", body: JSON.stringify(body) });
      setSuccessMsg("Đã lưu bản nháp thành công!");
      resetForm(); setCreationMode(null);
    } catch (e: unknown) { setCreateError(e instanceof Error ? e.message : "Tạo bài tập thất bại"); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setRubric(""); setMaxScore(100); setClassId("");
    setDueDate(""); setSelectedFile(null); setSelectedStudentIds([]);
    setGeneratedQuestions([]); setGeneratedTitle(""); setGenerateError(null);
    setSelectedSubjectId(""); setSelectedLessonId("");
    setSelectedClassId(""); setSelectedTopic(null); setTopics([]);
    setTestMatrix(null); setWizardStep("config");
  };

  const updateQuestion = (index: number, field: keyof GeneratedQuestion, value: string | number) => {
    setGeneratedQuestions((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  };
  const removeQuestion = (index: number) => { setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index)); };

  // ---- Render ----
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 px-6 pt-4 pb-3 border-b bg-white">
        <Link
          href="/teacher/assignments"
          className="inline-flex items-center gap-2 text-primary hover:gap-3 transition-all font-medium text-sm mb-1 group"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          Quay lại danh sách bài tập
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Tạo bài tập mới</h1>
        <p className="text-sm text-gray-500">Chọn phương thức tạo và làm theo hướng dẫn</p>

        {/* Success / Error */}
        {successMsg && <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">{successMsg}</div>}
        {createError && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{createError}</div>}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

      {/* ── Step 1: Mode Selection ── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider">Bước 1</span>
          <div className="h-px w-8 bg-gray-200" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Chọn phương thức tạo</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MODES.map((m) => {
            const selected = creationMode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => switchMode(m.key)}
                className={`relative flex flex-col text-left p-6 rounded-3xl border-2 transition-all duration-300 bg-gradient-to-br ${m.gradient} ${
                  selected
                    ? `${m.activeBorder} shadow-lg shadow-${m.key === "lesson" ? "blue" : m.key === "weakness" ? "pink" : "emerald"}-200/50 scale-[1.02] ring-2 ring-offset-2 ring-blue-300`
                    : `${m.border} hover:-translate-y-1 hover:shadow-xl`
                }`}
              >
                {/* Decorative circle */}
                <div className={`absolute top-0 right-0 w-28 h-28 rounded-full ${m.accent} -mr-12 -mt-12 transition-transform ${selected ? "scale-125" : "group-hover:scale-110"}`} />

                <div className={`flex items-center justify-center size-12 rounded-2xl ${m.iconBg} mb-4 shadow-sm relative z-10`}>
                  <m.icon className="size-6" />
                </div>
                <h4 className={`font-bold text-lg mb-2 relative z-10 ${m.textColor}`}>{m.label}</h4>
                <p className="text-sm text-gray-500 leading-relaxed mb-6 relative z-10 flex-1">{m.desc}</p>

                <div className={`flex items-center font-semibold text-sm relative z-10 ${m.textColor}`}>
                  {m.cta}
                  <ChevronRight className="size-4 ml-1 transition-transform group-hover:translate-x-0.5" />
                </div>
                {selected && (
                  <div className="absolute top-3 right-3 size-6 bg-blue-500 rounded-full flex items-center justify-center z-20">
                    <CheckCircle2 className="size-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Step 2: Mode-specific form ── */}
      {creationMode && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider">Bước 2</span>
            <div className="h-px w-8 bg-gray-200" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{MODES.find((m) => m.key === creationMode)?.label}</h3>
          </div>

          <Card className="rounded-3xl border-0 ring-1 ring-gray-200/60 shadow-sm overflow-hidden">
            <CardContent className="p-6 lg:p-8">

              {/* === MODE: Từ bài học === */}
              {creationMode === "lesson" && (
                <div className="space-y-6">
                  {/* Step 1: Config */}
                  {wizardStep === "config" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                      <div className="lg:col-span-3">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Môn học</Label>
                        <Select value={selectedSubjectId} onValueChange={(v) => setSelectedSubjectId(v ?? "")}>
                          <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="Chọn môn...">{(value: string) => subjects.find((s) => s.id === value)?.name || ""}</SelectValue></SelectTrigger>
                          <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-3">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Bài học</Label>
                        <Select value={selectedLessonId} onValueChange={(v) => setSelectedLessonId(v ?? "")} disabled={!selectedSubjectId}>
                          <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder={selectedSubjectId ? "Chọn bài học..." : "Chọn môn trước"}>{(value: string) => lessons.find((l) => l.id === value)?.title || ""}</SelectValue></SelectTrigger>
                          <SelectContent>{lessons.map((l) => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Loại câu hỏi</Label>
                        <Select value={questionType} onValueChange={(v) => setQuestionType(v ?? "mixed")}>
                          <SelectTrigger className="rounded-xl w-full"><SelectValue>{(value: string) => ({ mixed: "Hỗn hợp", mcq: "Trắc nghiệm", open_ended: "Tự luận" })[value] || value}</SelectValue></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mixed">Hỗn hợp</SelectItem>
                            <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                            <SelectItem value="open_ended">Tự luận</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Số câu</Label>
                        <Select value={String(questionCount)} onValueChange={(v) => setQuestionCount(Number(v))}>
                          <SelectTrigger className="rounded-xl w-full"><SelectValue>{(value: string) => `${value} câu`}</SelectValue></SelectTrigger>
                          <SelectContent>{[5,10,15,20].map((n) => <SelectItem key={n} value={String(n)}>{n} câu</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="lg:col-span-2 flex flex-col gap-2">
                        <Button onClick={() => setWizardStep("matrix")} disabled={!selectedLessonId} className="gap-2 rounded-xl w-full" variant="default">
                          Tiếp tục: Thiết lập ma trận
                        </Button>
                        <Button onClick={handleGenerateFromLesson} disabled={!selectedLessonId || generatingQuestions} className="gap-2 rounded-xl w-full" variant="outline">
                          {generatingQuestions ? <><Loader2 className="size-4 animate-spin" /> Đang tạo...</> : <><Sparkles className="size-4" /> Tạo ngay bằng AI</>}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Matrix */}
                  {wizardStep === "matrix" && (
                    <MatrixStep
                      questionCount={questionCount}
                      onGenerate={handleGenerateWithMatrix}
                      onSkip={() => {
                        setTestMatrix(null);
                        handleGenerateFromLesson();
                      }}
                      loading={generatingQuestions}
                    />
                  )}

                  {generateError && <div className="p-4 bg-red-50 rounded-xl text-sm text-red-600">{generateError}</div>}

                  {/* Generating progress overlay */}
                  <GeneratingOverlay
                    loading={generatingQuestions}
                    questionCount={testMatrix ? computeTotals(testMatrix).grandTotal.questionCount : questionCount}
                    hasMatrix={!!testMatrix}
                  />

                  {/* Question preview */}
                  <QuestionPreview questions={generatedQuestions} updateQuestion={updateQuestion} removeQuestion={removeQuestion} title={generatedTitle} onTitleChange={setGeneratedTitle} />

                  {/* Save section */}
                  {generatedQuestions.length > 0 && (
                    <div className="border-t pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Lớp (tuỳ chọn)</Label>
                            <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Tất cả</SelectItem>
                                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hạn nộp (tuỳ chọn)</Label>
                            <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Học sinh nhận bài (để trống = cả lớp)</Label>
                          <div className="max-h-36 overflow-y-auto border rounded-xl p-2 space-y-0.5 mt-1">
                            {students.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                                <input type="checkbox" checked={selectedStudentIds.includes(s.supabaseId)} onChange={() => setSelectedStudentIds((prev) => prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId])} className="rounded" />
                                <span className="text-sm">{s.fullName}</span>
                              </label>
                            ))}
                          </div>
                          {selectedStudentIds.length > 0 && <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiêu chí chấm điểm</Label>
                          <Textarea value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%" rows={2} className="rounded-xl" />
                        </div>
                        {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{createError}</div>}
                        <div className="flex gap-3 pt-2">
                          <Button onClick={handleCreate} disabled={submitting} className="gap-2 rounded-xl">
                            {submitting ? <><Loader2 className="size-4 animate-spin" /> Đang lưu nháp...</> : <><Plus className="size-4" /> Lưu bản nháp</>}
                          </Button>
                          <Button variant="outline" onClick={() => switchMode("lesson")} className="rounded-xl">Huỷ</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === MODE: Khắc phục điểm yếu === */}
              {creationMode === "weakness" && (
                <div className="space-y-6">
                  <div className="flex items-end gap-4 p-5 bg-pink-50/50 rounded-2xl border border-pink-100">
                    <div className="w-64">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Chọn lớp cần phân tích</Label>
                      <Select value={selectedClassId} onValueChange={(v) => setSelectedClassId(v ?? "")}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn lớp...">{(value: string) => classes.find((c) => c.id === value)?.name || ""}</SelectValue></SelectTrigger>
                        <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {selectedClassId && !loadingTopics && (
                      <p className="text-sm text-gray-500 pb-2">{topics.length} chủ đề điểm yếu được tìm thấy</p>
                    )}
                  </div>

                  {selectedClassId && (
                    <>
                      {loadingTopics ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center"><Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu điểm yếu...</div>
                      ) : topics.length === 0 ? (
                        <div className="p-10 text-center bg-gray-50 rounded-2xl">
                          <Brain className="size-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-500">Lớp này không có điểm yếu nào</p>
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
                              <TableRow key={t.topic} className={selectedTopic?.topic === t.topic ? "bg-pink-50" : ""}>
                                <TableCell className="font-medium">{t.topic}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline" className="text-xs">{t.studentCount}</Badge></TableCell>
                                <TableCell className="text-center text-red-500 font-medium">{t.totalErrors}</TableCell>
                                <TableCell>
                                  <Button size="sm" variant={selectedTopic?.topic === t.topic ? "default" : "outline"} onClick={() => setSelectedTopic(t)} className="rounded-lg">
                                    {selectedTopic?.topic === t.topic ? "Đã chọn" : "Chọn"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </>
                  )}

                  {selectedTopic && (
                    <div className="p-5 bg-pink-50 rounded-2xl border border-pink-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="size-5 text-pink-600" />
                        <span className="font-bold text-pink-700">Chủ đề đã chọn:</span>
                        <Badge variant="default">{selectedTopic.topic}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{selectedTopic.studentCount} học sinh cần khắc phục · {selectedTopic.totalErrors} lỗi được ghi nhận</p>
                      <p className="text-xs text-gray-400 mb-4">AI sẽ tạo câu hỏi nhắm vào chủ đề này và tự động gán cho những học sinh đang yếu.</p>
                      <Button onClick={handleGenerateRemediation} disabled={generatingQuestions} className="gap-2 rounded-xl">
                        {generatingQuestions ? <><Loader2 className="size-4 animate-spin" /> Đang tạo...</> : <><Sparkles className="size-4" /> Tạo bài tập khắc phục & Gán tự động</>}
                      </Button>
                    </div>
                  )}

                  {generateError && <div className="p-4 bg-red-50 rounded-xl text-sm text-red-600">{generateError}</div>}
                </div>
              )}

              {/* === MODE: Thủ công === */}
              {creationMode === "manual" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="mtitle" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiêu đề</Label>
                        <Input id="mtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề bài tập" className="rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="mdesc" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Mô tả / Câu hỏi</Label>
                        <Textarea id="mdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập nội dung câu hỏi hoặc yêu cầu bài tập" rows={5} className="rounded-xl" />
                      </div>
                      <div>
                        <Label htmlFor="mrubric" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tiêu chí chấm điểm</Label>
                        <Textarea id="mrubric" value={rubric} onChange={(e) => setRubric(e.target.value)} placeholder="VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%" rows={3} className="rounded-xl" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="mscore" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Điểm tối đa</Label>
                          <Input id="mscore" type="number" value={maxScore} onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)} min={1} max={100} className="rounded-xl" />
                        </div>
                        <div>
                          <Label htmlFor="mclass" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Lớp (tuỳ chọn)</Label>
                          <Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
                            <SelectTrigger id="mclass" className="rounded-xl"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Tất cả</SelectItem>
                              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="mdue" className="text-xs font-bold text-gray-400 uppercase tracking-wide">Hạn nộp (tuỳ chọn)</Label>
                        <Input id="mdue" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Tệp đính kèm (PDF, tuỳ chọn)</Label>
                        {selectedFile ? (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600 truncate flex-1">{selectedFile.name}</span>
                            <Button variant="outline" size="sm" onClick={() => setSelectedFile(null)} className="text-red-500 hover:text-red-700 shrink-0 rounded-lg">Gỡ</Button>
                          </div>
                        ) : (
                          <Input type="file" accept="application/pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="rounded-xl" />
                        )}
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Học sinh nhận bài (để trống = cả lớp)</Label>
                        <div className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-0.5 mt-1">
                          {students.map((s) => (
                            <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                              <input type="checkbox" checked={selectedStudentIds.includes(s.supabaseId)} onChange={() => setSelectedStudentIds((prev) => prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId])} className="rounded" />
                              <span className="text-sm">{s.fullName}</span>
                            </label>
                          ))}
                        </div>
                        {selectedStudentIds.length > 0 && <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>}
                      </div>
                    </div>
                  </div>
                  {createError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{createError}</div>}
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleCreate} disabled={submitting} className="gap-2 rounded-xl">
                      {submitting ? <><Loader2 className="size-4 animate-spin" /> Đang lưu nháp...</> : <><Plus className="size-4" /> Lưu bản nháp</>}
                    </Button>
                    <Button variant="outline" onClick={() => switchMode("manual")} className="rounded-xl">Huỷ</Button>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Help section (when no mode selected) */}
      {!creationMode && (
        <section className="mt-12 p-6 lg:p-8 bg-blue-50/50 rounded-3xl flex flex-col md:flex-row items-center gap-6 justify-between border border-blue-100">
          <div className="flex items-center gap-5">
            <div className="size-14 bg-white rounded-2xl flex items-center justify-center shadow-sm text-blue-600">
              <Sparkles className="size-7" />
            </div>
            <div>
              <h5 className="font-bold text-lg text-gray-900 mb-1">Cần hỗ trợ từ trợ lý AI?</h5>
              <p className="text-sm text-gray-500">AI có thể gợi ý các chủ đề bài tập dựa trên tiến độ học tập hiện tại của lớp bạn.</p>
            </div>
          </div>
          <Button className="bg-primary text-white px-6 py-3 rounded-2xl font-semibold shadow-lg shadow-blue-200 whitespace-nowrap">
            <Sparkles className="size-4 mr-2" /> Trò chuyện với AI
          </Button>
        </section>
      )}
      </div>
    </div>
  );
}
