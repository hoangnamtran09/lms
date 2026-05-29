"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, Trash2, Edit3, Library, Loader2, X,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { COGNITIVE_LEVELS, LEVEL_LABELS, type CognitiveLevel } from "@/lib/test-matrix";

interface QuestionBankItem {
  id: string;
  question: string;
  answer: string;
  topic: string;
  subjectId: string;
  cognitiveLevel: string;
  questionType: string;
  options: string;
  explanation: string;
  score: number;
  createdBy: string;
  createdAt: string;
}

interface Subject {
  id: string;
  name: string;
}

const LEVEL_COLORS: Record<string, string> = {
  nhan_biet: "bg-blue-100 text-blue-700 border-blue-200",
  thong_hieu: "bg-green-100 text-green-700 border-green-200",
  van_dung: "bg-amber-100 text-amber-700 border-amber-200",
  van_dung_cao: "bg-red-100 text-red-700 border-red-200",
};

const TYPE_LABELS: Record<string, string> = {
  mcq: "Trắc nghiệm",
  open_ended: "Tự luận",
  mixed: "Hỗn hợp",
};

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Filters
  const [filterSubject, setFilterSubject] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formType, setFormType] = useState("open_ended");
  const [formOptions, setFormOptions] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formScore, setFormScore] = useState(1);

  const fetchQuestions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterSubject) params.set("subjectId", filterSubject);
    if (filterLevel) params.set("cognitiveLevel", filterLevel);
    if (filterType) params.set("questionType", filterType);
    if (filterSearch) params.set("search", filterSearch);
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));

    api<{ data: QuestionBankItem[]; total: number }>(`/api/question-bank?${params}`)
      .then((res) => { setQuestions(res.data); setTotal(res.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterSubject, filterLevel, filterType, filterSearch, page]);

  useEffect(() => {
    api<Subject[]>("/api/subjects").then((d) => setSubjects(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const openCreate = () => {
    setEditingId(null);
    setFormQuestion(""); setFormAnswer(""); setFormTopic("");
    setFormSubjectId(""); setFormLevel(""); setFormType("open_ended");
    setFormOptions(""); setFormExplanation(""); setFormScore(1);
    setFormError("");
    setDialogOpen(true);
  };

  const openEdit = (item: QuestionBankItem) => {
    setEditingId(item.id);
    setFormQuestion(item.question);
    setFormAnswer(item.answer);
    setFormTopic(item.topic);
    setFormSubjectId(item.subjectId);
    setFormLevel(item.cognitiveLevel);
    setFormType(item.questionType);
    setFormOptions(item.options ? (typeof item.options === "string" ? item.options : JSON.stringify(item.options)) : "");
    setFormExplanation(item.explanation);
    setFormScore(item.score);
    setFormError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formQuestion.trim()) { setFormError("Vui lòng nhập câu hỏi"); return; }
    setSaving(true); setFormError("");
    try {
      const body: Record<string, unknown> = {
        question: formQuestion.trim(),
        answer: formAnswer.trim(),
        topic: formTopic.trim(),
        subjectId: formSubjectId,
        cognitiveLevel: formLevel,
        questionType: formType,
        options: formOptions.trim(),
        explanation: formExplanation.trim(),
        score: formScore,
      };
      if (editingId) {
        await api(`/api/question-bank/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/api/question-bank", { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      fetchQuestions();
    } catch (e: unknown) {
      setFormError(e instanceof ApiError ? e.message : "Lỗi lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá câu hỏi này?")) return;
    try {
      await api(`/api/question-bank/${id}`, { method: "DELETE" });
      fetchQuestions();
    } catch {
      // ignore
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 text-primary hover:gap-3 transition-all font-medium text-sm mb-1 group"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Quay lại tổng quan
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-gray-500">{total} câu hỏi</p>
        </div>
        <Button onClick={openCreate} className="gap-2 rounded-xl">
          <Plus className="size-4" /> Thêm câu hỏi
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Môn học</Label>
              <Select value={filterSubject} onValueChange={(v) => { setFilterSubject(v ?? ""); setPage(0); }}>
                <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Cấp độ</Label>
              <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v ?? ""); setPage(0); }}>
                <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả</SelectItem>
                  {COGNITIVE_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{LEVEL_LABELS[l as CognitiveLevel]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Loại</Label>
              <Select value={filterType} onValueChange={(v) => { setFilterType(v ?? ""); setPage(0); }}>
                <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="Tất cả" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tất cả</SelectItem>
                  <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                  <SelectItem value="open_ended">Tự luận</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setPage(0); }}
                  placeholder="Tìm câu hỏi, chủ đề..."
                  className="pl-9 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60">
          <CardContent className="p-12 text-center">
            <Library className="size-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Chưa có câu hỏi nào</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Thêm câu hỏi thủ công hoặc tạo bằng AI</p>
            <Button onClick={openCreate} className="gap-2 rounded-xl">
              <Plus className="size-4" /> Thêm câu hỏi đầu tiên
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-bold text-gray-400 uppercase">Câu hỏi</TableHead>
                  <TableHead className="text-xs font-bold text-gray-400 uppercase w-28">Chủ đề</TableHead>
                  <TableHead className="text-xs font-bold text-gray-400 uppercase w-28 text-center">Cấp độ</TableHead>
                  <TableHead className="text-xs font-bold text-gray-400 uppercase w-24 text-center">Loại</TableHead>
                  <TableHead className="text-xs font-bold text-gray-400 uppercase w-16 text-center">Điểm</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => {
                  let optionsText = "";
                  if (q.options) {
                    try {
                      const opts = typeof q.options === "string" ? JSON.parse(q.options) : q.options;
                      if (Array.isArray(opts)) {
                        optionsText = opts.map((o: { text: string; isCorrect: boolean }) =>
                          `${o.isCorrect ? "✓" : "✗"} ${o.text}`
                        ).join(" | ");
                      }
                    } catch { optionsText = ""; }
                  }
                  return (
                    <TableRow key={q.id} className="group">
                      <TableCell>
                        <div className="max-w-md">
                          <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.question}</p>
                          {q.answer && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">Đáp án: {q.answer}</p>}
                          {optionsText && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{optionsText}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-600">{q.topic || "—"}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        {q.cognitiveLevel ? (
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${LEVEL_COLORS[q.cognitiveLevel] || ""}`}>
                            {LEVEL_LABELS[q.cognitiveLevel as CognitiveLevel] || q.cognitiveLevel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-xs text-gray-600">{TYPE_LABELS[q.questionType] || q.questionType}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{q.score || 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(q)} className="p-1 text-gray-400 hover:text-blue-500" title="Sửa">
                            <Edit3 className="size-3.5" />
                          </button>
                          <button onClick={() => handleDelete(q.id)} className="p-1 text-gray-400 hover:text-red-500" title="Xoá">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0} className="rounded-lg"
              >
                <ChevronLeft className="size-4" /> Trước
              </Button>
              <span className="text-sm text-gray-500">
                Trang {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1} className="rounded-lg"
              >
                Sau <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingId ? "Sửa câu hỏi" : "Thêm câu hỏi mới"}
            </DialogTitle>
          </DialogHeader>

          {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{formError}</div>}

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Câu hỏi</Label>
              <Textarea
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                placeholder="Nhập nội dung câu hỏi..."
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Loại câu hỏi</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v ?? "open_ended")}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open_ended">Tự luận</SelectItem>
                    <SelectItem value="mcq">Trắc nghiệm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Cấp độ nhận thức</Label>
                <Select value={formLevel} onValueChange={(v) => setFormLevel(v ?? "")}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn cấp độ..." /></SelectTrigger>
                  <SelectContent>
                    {COGNITIVE_LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{LEVEL_LABELS[l as CognitiveLevel]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Chủ đề</Label>
                <Input value={formTopic} onChange={(e) => setFormTopic(e.target.value)} placeholder="VD: Phương trình bậc 2" className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Điểm</Label>
                <Input type="number" min={0.5} step={0.5} value={formScore} onChange={(e) => setFormScore(parseFloat(e.target.value) || 0)} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Môn học</Label>
                <Select value={formSubjectId} onValueChange={(v) => setFormSubjectId(v ?? "")}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn môn..." /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Đáp án (tuỳ chọn)</Label>
              <Textarea value={formAnswer} onChange={(e) => setFormAnswer(e.target.value)} placeholder="Nhập đáp án hoặc hướng dẫn chấm..." rows={2} className="rounded-xl" />
            </div>

            {formType === "mcq" && (
              <div>
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">
                  {"Lựa chọn (JSON format: [{\"text\": \"...\", \"isCorrect\": true/false}, ...])"}
                </Label>
                <Textarea value={formOptions} onChange={(e) => setFormOptions(e.target.value)} placeholder='[{"text": "Đáp án A", "isCorrect": true}, {"text": "Đáp án B", "isCorrect": false}]' rows={3} className="rounded-xl font-mono text-xs" />
              </div>
            )}

            <div>
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Giải thích (tuỳ chọn)</Label>
              <Textarea value={formExplanation} onChange={(e) => setFormExplanation(e.target.value)} placeholder="Giải thích đáp án..." rows={2} className="rounded-xl" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl">
              {saving ? <><Loader2 className="size-4 animate-spin" /> Đang lưu...</> : (editingId ? "Cập nhật" : "Thêm câu hỏi")}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Huỷ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
