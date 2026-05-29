"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface GeneratedQuestion {
  id: string;
  question: string;
  expectedAnswer?: string;
  score?: number;
  type?: string;
  topic?: string;
  difficulty?: string;
  options?: { text: string; isCorrect: boolean }[];
  explanation?: string;
}

const difficultyLabels: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

const difficultyColors: Record<string, string> = {
  nhan_biet: "bg-emerald-100 text-emerald-700 border-emerald-200",
  thong_hieu: "bg-blue-100 text-blue-700 border-blue-200",
  van_dung: "bg-orange-100 text-orange-700 border-orange-200",
  van_dung_cao: "bg-red-100 text-red-700 border-red-200",
};

const DIFFICULTY_OPTIONS = ["nhan_biet", "thong_hieu", "van_dung", "van_dung_cao"];

function groupByTopic(questions: GeneratedQuestion[]) {
  const groups: { topic: string; items: GeneratedQuestion[] }[] = [];
  const seen = new Map<string, GeneratedQuestion[]>();
  for (const q of questions) {
    const key = q.topic || "Không chủ đề";
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(q);
  }
  // Put "no topic" last
  for (const [k, v] of seen) {
    if (k === "Không chủ đề") continue;
    groups.push({ topic: k, items: v });
  }
  const none = seen.get("Không chủ đề");
  if (none) groups.push({ topic: "Không chủ đề", items: none });
  return groups;
}

export default function QuestionPreview({
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

  const hasTopics = questions.some((q) => q.topic);
  const grouped = hasTopics ? groupByTopic(questions) : null;

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

      {grouped ? (
        /* Grouped by topic */
        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
          {grouped.map((group) => (
            <div key={group.topic}>
              <h4 className="text-sm font-bold text-gray-600 mb-2 border-b pb-1.5">{group.topic}</h4>
              <div className="space-y-3">
                {group.items.map((q, gi) => {
                  const i = questions.indexOf(q);
                  return (
                    <QuestionCard key={q.id} q={q} i={i} updateQuestion={updateQuestion} removeQuestion={removeQuestion} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat list */
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} i={i} updateQuestion={updateQuestion} removeQuestion={removeQuestion} />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        <span>Tổng điểm:</span>
        <Badge variant="default">
          {questions.reduce((s, q) => s + (q.score || 10), 0)}
        </Badge>
        <span className="mx-2">·</span>
        <span>Phân bố:</span>
        {DIFFICULTY_OPTIONS.map((d) => {
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

function QuestionCard({
  q,
  i,
  updateQuestion,
  removeQuestion,
}: {
  q: GeneratedQuestion;
  i: number;
  updateQuestion: (index: number, field: keyof GeneratedQuestion, value: string | number) => void;
  removeQuestion: (index: number) => void;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
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
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>{difficultyLabels[d]}</option>
              ))}
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
              onChange={(e) => updateQuestion(i, "score", parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.5}
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
  );
}
