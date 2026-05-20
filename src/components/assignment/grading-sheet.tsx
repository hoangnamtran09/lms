"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, X, Sparkles, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, GraduationCap, Clock, Hash, MessageSquareText } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MathText } from "@/components/ai/math-text";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectQuestionType(q: Question): "mcq" | "short_answer" {
  if (q.type === "mcq" || (q.options && q.options.length > 0)) return "mcq";
  if (q.type === "short_answer") return "short_answer";
  const letterAnswer = /^[A-D]$/i.test(q.expectedAnswer?.trim() || "");
  const hasOptionPattern = /[A-D]\.\s/.test(q.question);
  if (letterAnswer && hasOptionPattern) return "mcq";
  return "short_answer";
}

function parseStudentAnswers(content: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const parsed = JSON.parse(content);
    if (parsed.answers && Array.isArray(parsed.answers)) {
      parsed.answers.forEach((a: { questionId: string; answer: string }) => {
        map.set(a.questionId, a.answer || "");
      });
    }
  } catch {}
  return map;
}

function parseExistingFeedback(feedback: string): QuestionResult[] {
  // Try direct parse first
  try {
    const parsed = JSON.parse(feedback);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Find JSON array embedded in text (e.g. "Tổng điểm: 4/10\n[{...}]")
  const start = feedback.indexOf("[");
  if (start > 0) {
    try {
      const parsed = JSON.parse(feedback.substring(start));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GradingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: Submission[];
  questions: Question[];
  maxScore: number;
  rubric: string;
  initialIndex: number;
  onGraded: () => void;
  assignmentId: string;
}

export function GradingSheet({
  open,
  onOpenChange,
  submissions,
  questions,
  maxScore,
  rubric,
  initialIndex,
  onGraded,
  assignmentId,
}: GradingSheetProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [perQuestionScores, setPerQuestionScores] = useState<Record<string, number>>({});
  const [perQuestionFeedback, setPerQuestionFeedback] = useState<Record<string, string>>({});
  const [generalFeedback, setGeneralFeedback] = useState("");
  const [grading, setGrading] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExpectedAnswers, setShowExpectedAnswers] = useState<Record<string, boolean>>({});

  const sub = submissions[currentIndex];
  const isAlreadyGraded = sub?.score != null;

  const studentAnswers = useMemo(
    () => (sub ? parseStudentAnswers(sub.content) : new Map<string, string>()),
    [sub]
  );

  useEffect(() => {
    if (!sub) return;
    setGeneralFeedback("");
    setError(null);

    const existingFeedback = parseExistingFeedback(sub.feedback);
    const scores: Record<string, number> = {};
    const feedbacks: Record<string, string> = {};

    if (existingFeedback.length > 0) {
      existingFeedback.forEach((r) => {
        scores[r.questionId] = r.score;
        feedbacks[r.questionId] = r.feedback || "";
      });
    } else if (questions.length > 0) {
      questions.forEach((q) => {
        if (detectQuestionType(q) === "mcq") {
          const studentLetter = (studentAnswers.get(q.id) || "").trim().toUpperCase();
          const correctLetter = q.expectedAnswer?.trim().toUpperCase();
          scores[q.id] = studentLetter === correctLetter ? (q.score || 10) : 0;
        } else {
          scores[q.id] = 0;
        }
        feedbacks[q.id] = "";
      });
    }

    setPerQuestionScores(scores);
    setPerQuestionFeedback(feedbacks);
  }, [currentIndex, sub?.id]);

  const totalScore = questions.length > 0
    ? Object.values(perQuestionScores).reduce((s, v) => s + (v || 0), 0)
    : 0;

  const toggleExpectedAnswer = (questionId: string) => {
    setShowExpectedAnswers((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // ---- API calls ----

  const handleGrade = async () => {
    if (!sub) return;
    setGrading(true);
    setError(null);
    try {
      const questionResults: QuestionResult[] = questions.length > 0
        ? questions.map((q) => ({
            questionId: q.id,
            question: q.question,
            score: perQuestionScores[q.id] || 0,
            maxScore: q.score || 10,
            feedback: perQuestionFeedback[q.id] || "",
          }))
        : [];
      const feedbackJson = questionResults.length > 0
        ? JSON.stringify(questionResults)
        : generalFeedback;
      await api(`/api/submissions/${sub.id}/grade`, {
        method: "PATCH",
        body: JSON.stringify({ score: totalScore, feedback: feedbackJson }),
      });
      onGraded();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || "Chấm điểm thất bại");
    } finally {
      setGrading(false);
    }
  };

  const handleAutoGrade = async () => {
    if (!sub) return;
    setAutoGrading(true);
    setError(null);
    try {
      await api(`/api/submissions/${sub.id}/auto-grade`, { method: "POST" });
      onGraded();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || "Chấm AI thất bại");
    } finally {
      setAutoGrading(false);
    }
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= submissions.length) return;
    setCurrentIndex(idx);
  };

  // ---- Render helpers ----

  const renderMcqAnswer = (q: Question) => {
    const studentLetter = (studentAnswers.get(q.id) || "").trim().toUpperCase();
    const correctLetter = q.expectedAnswer?.trim().toUpperCase();
    const isCorrect = studentLetter && studentLetter === correctLetter;
    const options = q.options && q.options.length > 0 ? q.options : null;

    return (
      <div className="space-y-3">
        {/* Student vs Correct answer comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl border-2 p-3 ${isCorrect ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Học sinh chọn</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center justify-center size-8 rounded-full text-sm font-bold border-2 ${isCorrect ? "border-emerald-300 bg-emerald-100 text-emerald-700" : "border-red-300 bg-red-100 text-red-700"}`}>
                {studentLetter || "—"}
              </span>
              {isCorrect ? (
                <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1"><Check className="size-3" /> Đúng</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 text-xs gap-1"><X className="size-3" /> Sai</Badge>
              )}
            </div>
          </div>
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Đáp án đúng</p>
            <span className="inline-flex items-center justify-center size-8 rounded-full text-sm font-bold border-2 border-emerald-300 bg-emerald-100 text-emerald-700">
              {correctLetter}
            </span>
          </div>
        </div>

        {/* Options grid */}
        {options && (
          <div className="grid grid-cols-2 gap-1.5">
            {options.map((opt, j) => {
              const letter = String.fromCharCode(65 + j);
              const isCorrectOption = opt.isCorrect || letter === correctLetter;
              const isSelected = letter === studentLetter;
              return (
                <div
                  key={j}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                    isCorrectOption
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : isSelected && !isCorrectOption
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  <span className={`flex items-center justify-center size-6 rounded-full text-xs font-bold border shrink-0 ${
                    isCorrectOption ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                    : isSelected ? "border-red-300 bg-red-100 text-red-700"
                    : "border-gray-200 bg-gray-100 text-gray-500"
                  }`}>{letter}</span>
                  <span className="flex-1">{opt.text}</span>
                  {isCorrectOption && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                  {isSelected && !isCorrectOption && <X className="size-3.5 text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderShortAnswer = (q: Question) => {
    const studentText = studentAnswers.get(q.id) || "";
    const showExpected = showExpectedAnswers[q.id];

    return (
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Câu trả lời của học sinh</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {studentText || <span className="text-gray-400 italic">(không trả lời)</span>}
          </p>
        </div>
        {q.expectedAnswer && (
          <div>
            <button
              onClick={() => toggleExpectedAnswer(q.id)}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wide"
            >
              {showExpected ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Đáp án mong đợi
            </button>
            {showExpected && (
              <div className="mt-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Đáp án</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <MathText text={q.expectedAnswer} />
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const hasQuestions = questions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-2xl lg:max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl"
        showCloseButton
      >
        {/* Header */}
        <DialogHeader className="shrink-0 px-6 py-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100/60">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center size-8 rounded-lg bg-indigo-100">
              <GraduationCap className="size-4 text-indigo-600" />
            </span>
            Chấm bài: {sub?.studentName || "—"}
          </DialogTitle>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {sub ? new Date(sub.submittedAt).toLocaleString("vi-VN") : "—"}
            </span>
            {isAlreadyGraded && sub && (
              <Badge className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                Đã chấm: {sub.score}/{maxScore}
              </Badge>
            )}
          </div>
          {submissions.length > 1 && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / submissions.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-gray-500 shrink-0">
                {currentIndex + 1} / {submissions.length}
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-gray-50/50">
          {error && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-sm text-red-600 flex items-center gap-2">
              <X className="size-4 shrink-0" /> {error}
            </div>
          )}

          {rubric && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm text-gray-700">
              <span className="font-semibold text-amber-800">Tiêu chí chấm:</span> {rubric}
            </div>
          )}

          {/* Per-question grading */}
          {hasQuestions ? (
            questions.map((q, i) => {
              const isMcq = detectQuestionType(q) === "mcq";
              return (
                <div key={q.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Question header */}
                  <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center size-7 rounded-lg bg-purple-100 text-xs font-bold text-purple-700">
                        {i + 1}
                      </span>
                      <Badge variant="outline" className="text-xs font-medium">
                        {isMcq ? "Trắc nghiệm" : "Tự luận"}
                      </Badge>
                      {q.difficulty && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${difficultyColors[q.difficulty] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {difficultyLabels[q.difficulty] || q.difficulty}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-medium">{q.score || 10}đ</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Question text */}
                    <p className="text-sm text-gray-800 leading-relaxed font-medium">
                      <MathText text={q.question} />
                    </p>

                    {/* Answer display */}
                    {isMcq ? renderMcqAnswer(q) : renderShortAnswer(q)}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-xs text-purple-700 leading-relaxed">
                        <span className="font-semibold">Giải thích:</span>{" "}
                        <MathText text={q.explanation} />
                      </div>
                    )}

                    {/* Scoring row */}
                    <div className="grid grid-cols-12 gap-3 pt-3 border-t border-gray-100">
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Điểm</Label>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Input
                            type="number"
                            value={perQuestionScores[q.id] ?? 0}
                            onChange={(e) =>
                              setPerQuestionScores((prev) => ({
                                ...prev,
                                [q.id]: Math.min(parseInt(e.target.value) || 0, q.score || 10),
                              }))
                            }
                            min={0}
                            max={q.score || 10}
                            className="h-9 text-sm w-16 text-center font-semibold"
                          />
                          <span className="text-xs text-gray-400 font-medium">/ {q.score || 10}</span>
                        </div>
                      </div>
                      <div className="col-span-9 sm:col-span-10">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhận xét</Label>
                        <Input
                          value={perQuestionFeedback[q.id] || ""}
                          onChange={(e) =>
                            setPerQuestionFeedback((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder={`Nhận xét câu ${i + 1}...`}
                          className="mt-1 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Câu trả lời của học sinh</Label>
                <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1.5 bg-gray-50 p-3 rounded-lg border leading-relaxed">
                  {sub?.content || <span className="text-gray-400 italic">(không có nội dung)</span>}
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nhận xét</Label>
                <Textarea
                  value={generalFeedback}
                  onChange={(e) => setGeneralFeedback(e.target.value)}
                  placeholder="Nhận xét bài làm..."
                  rows={4}
                  className="mt-1.5"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t bg-white rounded-b-2xl">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex <= 0}
              onClick={() => goTo(currentIndex - 1)}
              className="gap-1.5 rounded-lg"
            >
              <ChevronLeft className="size-4" /> Bài trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex >= submissions.length - 1}
              onClick={() => goTo(currentIndex + 1)}
              className="gap-1.5 rounded-lg"
            >
              Bài sau <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {hasQuestions && (
              <div className="flex items-center gap-2 mr-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                <Hash className="size-3.5 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">
                  {totalScore}<span className="text-gray-400 font-normal">/{maxScore}</span>
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoGrade}
              disabled={autoGrading || grading || isAlreadyGraded}
              className="gap-1.5 rounded-lg border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              {autoGrading ? (
                <><Loader2 className="size-3.5 animate-spin" /> Đang chấm...</>
              ) : (
                <><Sparkles className="size-3.5" /> Chấm AI</>
              )}
            </Button>
            <Button size="sm" onClick={handleGrade} disabled={grading || autoGrading} className="gap-1.5 rounded-lg font-semibold">
              {grading ? (
                <><Loader2 className="size-3.5 animate-spin" /> Đang lưu...</>
              ) : (
                <><MessageSquareText className="size-3.5" /> Lưu điểm</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
