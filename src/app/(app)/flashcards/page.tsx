"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Plus, ChevronRight, Loader2, Trash2, Upload, FileText, X } from "lucide-react";

interface Deck {
  id: string;
  title: string;
  lessonId: string;
  dueCount: number;
  totalCards: number;
  createdAt: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Lesson {
  id: string;
  title: string;
  courseId: string;
}

interface Course {
  id: string;
  subjectId: string;
  title: string;
}

export default function FlashcardsPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [cardCount, setCardCount] = useState(10);
  const [creating, setCreating] = useState(false);

  // Import modal state
  const [showImport, setShowImport] = useState(false);
  const [importTitle, setImportTitle] = useState("");
  const [importLessonId, setImportLessonId] = useState("");
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"text" | "file">("text");
  const [importPreview, setImportPreview] = useState<{ question: string; answer: string }[]>([]);
  const [importing, setImporting] = useState(false);
  // Lesson cascade for import modal
  const [importSubjects, setImportSubjects] = useState<Subject[]>([]);
  const [importCourses, setImportCourses] = useState<Course[]>([]);
  const [importLessons, setImportLessons] = useState<Lesson[]>([]);
  const [importSubjectId, setImportSubjectId] = useState("");
  const [importCourseId, setImportCourseId] = useState("");

  // Parse text input: auto-detect separator (tab, pipe, or \x1f from Anki)
  function parseImportText(text: string) {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) { setImportPreview([]); return; }
    // Auto-detect separator: count occurrences in first line
    const first = lines[0];
    const seps = ["\x1f", "\t", "|"];
    let bestSep = "|";
    let bestCount = 0;
    for (const sep of seps) {
      const count = first.split(sep).length - 1;
      if (count > bestCount) { bestCount = count; bestSep = sep; }
    }
    // If no separator found with any, fall back to pipe
    if (bestCount === 0) bestSep = "|";

    const cards = lines.map((line) => {
      const sepIdx = line.indexOf(bestSep);
      if (sepIdx === -1) return { question: line.trim(), answer: "" };
      return {
        question: line.slice(0, sepIdx).trim(),
        answer: line.slice(sepIdx + bestSep.length).trim(),
      };
    }).filter((c) => c.question);
    setImportPreview(cards);
  }

  // Parse CSV file
  function parseCSV(content: string) {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) { setImportPreview([]); return; }
    const cards = lines.slice(1).map((line) => {
      // Simple CSV: split by comma, handle quoted fields
      const parts = line.split(",");
      if (parts.length < 2) return null;
      return { question: parts[0].trim().replace(/^"|"$/g, ""), answer: parts[1].trim().replace(/^"|"$/g, "") };
    }).filter((c): c is { question: string; answer: string } => c !== null && c.question !== "");
    setImportPreview(cards);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    // .apkg files need backend parsing
    if (file.name.endsWith(".apkg")) {
      setImportPreview([]);
      const formData = new FormData();
      formData.append("file", file);
      api<{ cards: { question: string; answer: string }[]; deckTitle?: string }>("/api/flashcards/import-apkg", {
        method: "POST",
        body: formData,
        headers: {}, // let browser set Content-Type for multipart
      })
        .then((data) => {
          setImportPreview(data.cards || []);
          if (data.deckTitle && !importTitle) setImportTitle(data.deckTitle);
        })
        .catch(() => setImportPreview([]));
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (file.name.endsWith(".json")) {
        try {
          const json = JSON.parse(content);
          const arr = Array.isArray(json) ? json : json.cards || [];
          const cards = arr.map((c: Record<string, unknown>) => ({
            question: String(c.question || c.Question || ""),
            answer: String(c.answer || c.Answer || ""),
          })).filter((c: { question: string }) => c.question);
          setImportPreview(cards);
        } catch { setImportPreview([]); }
      } else {
        parseCSV(content);
      }
    };
    reader.readAsText(file);
  }

  async function loadImportLessonData() {
    try {
      const subj = await api<Subject[]>("/api/subjects");
      setImportSubjects(subj);
    } catch {}
  }

  async function handleImportSubjectChange(id: string) {
    setImportSubjectId(id);
    setImportCourseId("");
    setImportLessonId("");
    try {
      const c = await api<Course[]>(`/api/courses?subjectId=${id}`);
      setImportCourses(c);
    } catch { setImportCourses([]); }
  }

  async function handleImportCourseChange(id: string) {
    setImportCourseId(id);
    setImportLessonId("");
    try {
      const l = await api<Lesson[]>(`/api/lessons?courseId=${id}`);
      setImportLessons(l);
    } catch { setImportLessons([]); }
  }

  async function handleImport() {
    if (!importTitle.trim() || importPreview.length === 0) return;
    setImporting(true);
    try {
      await api<Deck>("/api/flashcards/decks", {
        method: "POST",
        body: JSON.stringify({
          lessonId: importLessonId,
          title: importTitle.trim(),
          cards: importPreview.map((c) => ({ question: c.question, answer: c.answer })),
        }),
      });
      setShowImport(false);
      resetImportForm();
      fetchDecks();
    } catch (err: unknown) {
      alert("Lỗi tạo bộ thẻ: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setImporting(false);
    }
  }

  function resetImportForm() {
    setImportTitle("");
    setImportLessonId("");
    setImportText("");
    setImportFile(null);
    setImportMode("text");
    setImportPreview([]);
    setImportSubjectId("");
    setImportCourseId("");
    setImportSubjects([]);
    setImportCourses([]);
    setImportLessons([]);
  }

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    try {
      const data = await api<Deck[]>("/api/flashcards/decks");
      setDecks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  async function loadCreateData() {
    setShowCreate(true);
    try {
      const subj = await api<Subject[]>("/api/subjects");
      setSubjects(subj);
    } catch {}
  }

  async function handleSubjectChange(id: string) {
    setSelectedSubjectId(id);
    setSelectedCourseId("");
    setSelectedLessonId("");
    try {
      const c = await api<Course[]>(`/api/courses?subjectId=${id}`);
      setCourses(c);
    } catch { setCourses([]); }
  }

  async function handleCourseChange(id: string) {
    setSelectedCourseId(id);
    setSelectedLessonId("");
    try {
      const l = await api<Lesson[]>(`/api/lessons?courseId=${id}`);
      setLessons(l);
    } catch { setLessons([]); }
  }

  async function handleCreate() {
    if (!selectedLessonId) return;
    setCreating(true);
    try {
      const gen = await api<{ cards: { id: string; question: string; answer: string }[]; lessonTitle: string; subjectName: string }>(
        "/api/ai/flashcards/generate",
        { method: "POST", body: JSON.stringify({ lessonId: selectedLessonId, count: cardCount }) }
      );

      await api<Deck>("/api/flashcards/decks", {
        method: "POST",
        body: JSON.stringify({
          lessonId: selectedLessonId,
          title: `Thẻ học: ${gen.lessonTitle}`,
          cards: gen.cards.map((c) => ({ question: c.question, answer: c.answer })),
        }),
      });

      setShowCreate(false);
      fetchDecks();
    } catch (err: unknown) {
      alert("Lỗi tạo bộ thẻ: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(deckId: string) {
    if (!confirm("Xoá bộ thẻ này?")) return;
    try {
      await api(`/api/flashcards/decks/${deckId}`, { method: "DELETE" });
      fetchDecks();
    } catch {}
  }

  const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
  const totalCards = decks.reduce((s, d) => s + d.totalCards, 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton delay={0} className="h-8 w-48" />
          <Skeleton delay={60} className="h-5 w-72 mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} delay={80 + i * 60} className="h-24 rounded-xl" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} delay={200 + i * 80} className="h-20 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <Layers className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flashcards</h1>
          <p className="text-sm text-gray-500 mt-1">Ôn tập hiệu quả với thẻ học tập và lặp lại ngắt quãng</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowImport(true); loadImportLessonData(); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Upload className="size-4" />
            Nhập thẻ
          </button>
          <button
            onClick={loadCreateData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="size-4" />
            Tạo bộ thẻ mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <p className="text-2xl font-bold text-amber-700">{totalDue}</p>
          <p className="text-sm text-amber-600 font-medium">Thẻ cần ôn hôm nay</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
          <p className="text-2xl font-bold text-blue-700">{totalCards}</p>
          <p className="text-sm text-blue-600 font-medium">Tổng số thẻ</p>
        </div>
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200">
          <p className="text-2xl font-bold text-violet-700">{decks.length}</p>
          <p className="text-sm text-violet-600 font-medium">Bộ thẻ</p>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="size-16 text-gray-200 mx-auto mb-5" />
          <p className="text-lg font-semibold text-gray-500">Bạn chưa có bộ thẻ học tập nào</p>
          <p className="text-sm text-gray-400 mt-1">Tạo bộ thẻ từ bài học để bắt đầu ôn tập</p>
          <button
            onClick={loadCreateData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Tạo bộ thẻ đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {decks.map((deck) => (
            <div key={deck.id} className="flex items-center rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
              <Link
                href={`/flashcards/${deck.id}`}
                className="flex-1 flex items-center gap-4 p-4"
              >
                <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Layers className="size-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{deck.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(deck.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <div className="text-right mr-2">
                  {deck.dueCount > 0 ? (
                    <span className="text-sm font-semibold text-amber-600">{deck.dueCount} cần ôn</span>
                  ) : (
                    <span className="text-sm text-gray-400">Đã xong</span>
                  )}
                  <p className="text-xs text-gray-400">{deck.totalCards} thẻ</p>
                </div>
                <ChevronRight className="size-4 text-gray-300" />
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(deck.id); }}
                className="p-4 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Deck Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tạo bộ thẻ mới</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Môn học</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {courses.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Khoá học</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Chọn khoá học</option>
                    {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              )}

              {lessons.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bài học</label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Chọn bài học</option>
                    {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng thẻ: {cardCount}</label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={cardCount}
                  onChange={(e) => setCardCount(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>5</span><span>20</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedLessonId || creating}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="size-4 animate-spin" /> : null}
                {creating ? "Đang tạo..." : "Tạo bằng AI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowImport(false); resetImportForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Nhập thẻ từ bên ngoài</h2>
              <button onClick={() => { setShowImport(false); resetImportForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Deck title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên bộ thẻ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="VD: Từ vựng tiếng Anh chủ đề thời tiết"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Optional lesson */}
              <div>
                <button
                  onClick={() => {
                    if (importSubjects.length === 0) loadImportLessonData();
                    if (importSubjectId) { setImportSubjectId(""); setImportLessonId(""); return; }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {importSubjectId ? "Bỏ chọn bài học" : "+ Gắn vào bài học (tuỳ chọn)"}
                </button>
                {importSubjectId !== "" && (
                  <div className="mt-2 space-y-2">
                    <select value={importSubjectId} onChange={(e) => handleImportSubjectChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                      <option value="">Chọn môn học</option>
                      {importSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {importCourses.length > 0 && (
                      <select value={importCourseId} onChange={(e) => handleImportCourseChange(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                        <option value="">Chọn khoá học</option>
                        {importCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                    {importLessons.length > 0 && (
                      <select value={importLessonId} onChange={(e) => setImportLessonId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                        <option value="">Chọn bài học</option>
                        {importLessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Input mode tabs */}
              <div>
                <div className="flex border-b border-gray-200 mb-3">
                  <button
                    onClick={() => { setImportMode("text"); setImportFile(null); }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === "text" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <FileText className="size-4 inline mr-1" />
                    Nhập văn bản
                  </button>
                  <button
                    onClick={() => { setImportMode("file"); setImportText(""); }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importMode === "file" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    <Upload className="size-4 inline mr-1" />
                    Tải file
                  </button>
                </div>

                {importMode === "text" ? (
                  <div>
                    <textarea
                      value={importText}
                      onChange={(e) => { setImportText(e.target.value); parseImportText(e.target.value); }}
                      placeholder={"Mỗi dòng một thẻ, phân cách câu hỏi và câu trả lời bằng dấu | hoặc tab\nHỗ trợ import từ Anki (text export)\n\nVD:\nThủ đô của Việt Nam là gì?|Hà Nội\n2 + 2 = ?\t4"}
                      rows={8}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono resize-y"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
                      <Upload className="size-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {importFile ? importFile.name : "Chọn file CSV hoặc JSON"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">CSV: cột 1 câu hỏi, cột 2 câu trả lời</p>
                      <input
                        type="file"
                        accept=".csv,.json,.apkg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Preview */}
              {importPreview.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Xem trước: <span className="text-blue-600">{importPreview.length} thẻ</span>
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {importPreview.slice(0, 10).map((c, i) => (
                      <div key={i} className="text-xs text-gray-600 bg-white rounded px-2 py-1 border border-gray-100">
                        <span className="font-semibold">Q:</span> {c.question} <span className="text-gray-300 mx-1">|</span> <span className="font-semibold">A:</span> {c.answer || <span className="text-gray-400 italic">(trống)</span>}
                      </div>
                    ))}
                    {importPreview.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-1">... và {importPreview.length - 10} thẻ nữa</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowImport(false); resetImportForm(); }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleImport}
                disabled={!importTitle.trim() || importPreview.length === 0 || importing}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {importing ? "Đang tạo..." : `Tạo bộ thẻ (${importPreview.length} thẻ)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
