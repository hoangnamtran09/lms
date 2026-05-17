"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Plus, ChevronRight, Loader2, BookOpen, Trash2 } from "lucide-react";

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

  useEffect(() => {
    fetchDecks();
  }, []);

  async function fetchDecks() {
    try {
      const data = await api<Deck[]>("/api/flashcards/decks");
      setDecks(data);
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu");
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

      const deck = await api<Deck>("/api/flashcards/decks", {
        method: "POST",
        body: JSON.stringify({
          lessonId: selectedLessonId,
          title: `Thẻ học: ${gen.lessonTitle}`,
          cards: gen.cards.map((c) => ({ question: c.question, answer: c.answer })),
        }),
      });

      setShowCreate(false);
      fetchDecks();
    } catch (err: any) {
      alert("Lỗi tạo bộ thẻ: " + (err.message || "Unknown"));
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
        <button
          onClick={loadCreateData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="size-4" />
          Tạo bộ thẻ mới
        </button>
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
    </div>
  );
}
