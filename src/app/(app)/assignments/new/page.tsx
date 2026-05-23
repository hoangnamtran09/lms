"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { api, uploadFile } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import mammoth from "mammoth";

interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
}

interface ExtractedQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  score: number;
}

const backLink = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-6";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Question extraction state
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [extractingQuestions, setExtractingQuestions] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [aiRefining, setAiRefining] = useState(false);

  const splitQuestionsLocally = (text: string): ExtractedQuestion[] => {
    const questions: ExtractedQuestion[] = [];
    const lines = text.split(/\n/);
    let currentText = "";
    let started = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^\s*(?:Câu\s*|Bài\s*|Question\s*)?(\d+)[.):]\s*(.+)/i);

      if (match) {
        if (started && currentText.trim()) {
          const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
          questions.push({ id, question: currentText.trim(), expectedAnswer: "", score: 10 });
        }
        currentText = match[2] || "";
        started = true;
      } else if (started && line.trim()) {
        currentText += "\n" + line;
      }
    }

    if (started && currentText.trim()) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      questions.push({ id, question: currentText.trim(), expectedAnswer: "", score: 10 });
    }

    return questions;
  };

  useEffect(() => {
    api<StudentBrief[]>("/api/users?role=STUDENT")
      .then((data) => setStudents(data))
      .catch(() => {});
  }, []);

  const handleFileChange = async (file: File | null) => {
    setSelectedFile(file);
    setExtractedQuestions([]);
    setExtractError(null);

    if (!file) return;

    const isDocx = file.name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isDocx) return;

    setExtractingQuestions(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      const text = htmlResult.value
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      if (!text) {
        setExtractError("Không thể đọc nội dung từ file. File có thể trống hoặc không phải định dạng Word.");
        setExtractingQuestions(false);
        return;
      }

      // 1. Instant regex split
      const localQuestions = splitQuestionsLocally(text);
      if (localQuestions.length > 0) {
        setExtractedQuestions(localQuestions);
        const total = localQuestions.reduce((s, q) => s + (q.score || 10), 0);
        setMaxScore(total);
        setExtractingQuestions(false);

        // 2. Refine with AI in background
        setAiRefining(true);
        try {
          const aiResult = await api<{ questions: ExtractedQuestion[] }>("/api/ai/extract-questions", {
            method: "POST",
            body: JSON.stringify({ text }),
          });
          if (aiResult.questions && aiResult.questions.length > 0) {
            setExtractedQuestions(aiResult.questions);
            const total = aiResult.questions.reduce((s, q) => s + (q.score || 10), 0);
            setMaxScore(total);
          }
        } catch {
          // Keep regex results
        } finally {
          setAiRefining(false);
        }
        return;
      }

      // Fallback: no regex match, use AI only
      const aiResult = await api<{ questions: ExtractedQuestion[] }>("/api/ai/extract-questions", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setExtractedQuestions(aiResult.questions || []);
      if (aiResult.questions && aiResult.questions.length > 0) {
        const total = aiResult.questions.reduce((s, q) => s + (q.score || 10), 0);
        setMaxScore(total);
      }
    } catch (e: unknown) {
      setExtractError(e instanceof Error ? e.message : "Lỗi trích xuất câu hỏi");
    } finally {
      setExtractingQuestions(false);
    }
  };

  const updateQuestion = (index: number, field: keyof ExtractedQuestion, value: string | number) => {
    setExtractedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeQuestion = (index: number) => {
    setExtractedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề bài tập");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let attachmentUrl = "";
      const isDocx = selectedFile?.name.endsWith(".docx") || selectedFile?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (selectedFile && !isDocx) {
        const uploadResult = await uploadFile("/api/assignments/upload", selectedFile);
        attachmentUrl = uploadResult.url;
      }
      const totalScore = extractedQuestions.length > 0
        ? extractedQuestions.reduce((s, q) => s + (q.score || 10), 0)
        : maxScore;

      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
        maxScore: totalScore,
        classId: classId.trim(),
        attachmentUrl,
        studentIds: selectedStudentIds.length > 0 ? JSON.stringify(selectedStudentIds) : "",
      };
      if (extractedQuestions.length > 0) {
        body.questions = JSON.stringify(extractedQuestions);
      }
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push("/assignments");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link href="/assignments" className={backLink}>
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tạo bài tập mới</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-lg border p-6 space-y-4">
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
            placeholder="Nhập tiêu chí chấm điểm (VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%)"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="score">Điểm tối đa</Label>
            <Input
              id="score"
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
              min={1}
              max={10}
            />
          </div>

          <div>
            <Label htmlFor="class">Lớp (tuỳ chọn)</Label>
            <Input
              id="class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="ID của lớp học"
            />
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
          <Label htmlFor="file">Tệp đính kèm — PDF hoặc Word (tuỳ chọn)</Label>
          {selectedFile ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600 truncate flex-1">
                {selectedFile.name}
                {extractingQuestions && (
                  <span className="ml-2 inline-flex items-center text-blue-600">
                    <Loader2 className="size-3 animate-spin mr-1" />
                    Đang trích xuất...
                  </span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setExtractedQuestions([]);
                  setExtractError(null);
                }}
                className="text-red-500 hover:text-red-700 shrink-0"
              >
                Gỡ
              </Button>
            </div>
          ) : (
            <Input
              id="file"
              type="file"
              accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          )}
          {extractError && (
            <p className="text-sm text-red-500 mt-1">{extractError}</p>
          )}
        </div>

        {/* Extracted questions preview */}
        {extractingQuestions && (
          <div className="p-4 bg-blue-50 rounded-lg flex items-center gap-3">
            <Loader2 className="size-5 text-blue-600 animate-spin" />
            <p className="font-medium text-blue-800">Đang trích xuất câu hỏi...</p>
          </div>
        )}
        {extractedQuestions.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="size-5 text-purple-600" />
              <h3 className="font-bold text-gray-900">
                Đã trích xuất {extractedQuestions.length} câu hỏi
              </h3>
              {aiRefining && (
                <span className="text-sm text-blue-600 inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  AI đang tinh chỉnh...
                </span>
              )}
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {extractedQuestions.map((q, i) => (
                <div key={q.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-purple-600">Câu {i + 1}</span>
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
                      <div className="col-span-3">
                        <Label className="text-xs text-gray-500">Đáp án mong đợi</Label>
                        <Input
                          value={q.expectedAnswer}
                          onChange={(e) => updateQuestion(i, "expectedAnswer", e.target.value)}
                          placeholder="Nhập đáp án đúng..."
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-gray-500">Điểm</Label>
                        <Input
                          type="number"
                          value={q.score}
                          onChange={(e) => updateQuestion(i, "score", parseInt(e.target.value) || 0)}
                          min={1}
                          max={100}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              Tổng điểm: <Badge variant="default">{extractedQuestions.reduce((s, q) => s + (q.score || 10), 0)}</Badge>
            </p>
          </div>
        )}

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

        <div className="flex gap-3 pt-2">
          <Button onClick={handleCreate} disabled={submitting}>
            <Plus className="size-4 mr-2" />
            {submitting ? "Đang tạo..." : "Tạo bài tập"}
          </Button>
          <Link href="/assignments" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Huỷ
          </Link>
        </div>
      </div>
    </div>
  );
}
