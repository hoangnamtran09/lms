"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/ai/math-text";
import { Layers, ArrowLeft, CheckCircle2, Loader2, AlertCircle, Sparkles } from "lucide-react";

interface Deck {
  id: string;
  title: string;
  lessonId: string;
}

interface Card {
  id: string;
  question: string;
  answer: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
}

interface DeckData {
  deck: Deck;
  cards: Card[];
  totalCards: number;
}

export default function FlashcardReviewPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params);
  const [data, setData] = useState<DeckData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ easy: 0, medium: 0, hard: 0 });

  useEffect(() => {
    async function fetchDeck() {
      try {
        const result = await api<DeckData>(`/api/flashcards/decks/${deckId}`);
        setData(result);
      } catch (err: any) {
        setError(err.message || "Không thể tải bộ thẻ");
      } finally {
        setLoading(false);
      }
    }
    fetchDeck();
  }, [deckId]);

  async function handleReview(difficulty: "easy" | "medium" | "hard") {
    const card = data?.cards[currentIndex];
    if (!card || submitting) return;
    setSubmitting(true);

    try {
      await api("/api/flashcards/review", {
        method: "POST",
        body: JSON.stringify({ cardId: card.id, difficulty }),
      });
      setStats((s) => ({ ...s, [difficulty]: s[difficulty] + 1 }));
    } catch {}

    if (currentIndex + 1 >= (data?.cards.length || 0)) {
      setCompleted(true);
    } else {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={80} className="h-[400px] w-full max-w-lg mx-auto rounded-2xl" />
        <div className="flex justify-center gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} delay={200 + i * 60} className="h-12 w-28 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-20">
        <AlertCircle className="size-16 text-red-200 mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
        <Link href="/flashcards" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Quay lại
        </Link>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center py-16 animate-fade-in">
        <div className="size-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
          <CheckCircle2 className="size-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Hoàn thành buổi ôn tập!</h1>
        <p className="text-gray-500 mt-1">Bạn đã ôn xong {stats.easy + stats.medium + stats.hard} thẻ</p>

        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="text-center p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-2xl font-bold text-green-600">{stats.easy}</p>
            <p className="text-xs text-green-500 font-medium">Dễ</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-yellow-50 border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
            <p className="text-xs text-yellow-500 font-medium">Vừa</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-2xl font-bold text-red-600">{stats.hard}</p>
            <p className="text-xs text-red-500 font-medium">Khó</p>
          </div>
        </div>

        <Link
          href="/flashcards"
          className="mt-8 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Quay lại trang Flashcards
        </Link>
      </div>
    );
  }

  if (!data || data.cards.length === 0) {
    return (
      <div className="text-center py-20">
        <Sparkles className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">Bạn đã học hết các thẻ cho hôm nay!</p>
        <p className="text-sm text-gray-400 mt-1">Quay lại vào ngày mai để ôn tập tiếp</p>
        <Link href="/flashcards" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Quay lại
        </Link>
      </div>
    );
  }

  const card = data.cards[currentIndex];
  const progress = ((currentIndex) / data.cards.length) * 100;

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Link href="/flashcards" className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
          <ArrowLeft className="size-3" />
          Thoát
        </Link>
        <span className="text-sm text-gray-400">
          {currentIndex + 1} / {data.cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flip Card */}
      <div
        className="flip-card cursor-pointer select-none"
        style={{ perspective: "1000px" }}
        onClick={() => !submitting && setFlipped(!flipped)}
      >
        <div
          className="flip-card-inner relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "350px",
          }}
        >
          {/* Front — Question */}
          <div
            className="absolute inset-0 rounded-2xl border border-gray-200 bg-white shadow-lg flex flex-col items-center justify-center p-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-xs font-medium text-blue-500 uppercase tracking-wide mb-4">Câu hỏi</span>
            <div className="text-lg font-semibold text-gray-900 text-center leading-relaxed">
              <MathText text={card.question} />
            </div>
            <p className="absolute bottom-4 text-xs text-gray-400">Nhấn để lật thẻ</p>
          </div>

          {/* Back — Answer */}
          <div
            className="absolute inset-0 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-lg flex flex-col items-center justify-center p-8"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <span className="text-xs font-medium text-green-500 uppercase tracking-wide mb-4">Đáp án</span>
            <div className="text-lg font-semibold text-gray-900 text-center leading-relaxed">
              <MathText text={card.answer} />
            </div>
          </div>
        </div>
      </div>

      {/* Difficulty buttons */}
      {flipped && (
        <div className="flex gap-3 justify-center animate-fade-in">
          <button
            onClick={() => handleReview("hard")}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-medium text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Khó"}
          </button>
          <button
            onClick={() => handleReview("medium")}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium text-sm hover:bg-yellow-100 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Vừa"}
          </button>
          <button
            onClick={() => handleReview("easy")}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin mx-auto" /> : "Dễ"}
          </button>
        </div>
      )}
    </div>
  );
}
