"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { InteractiveQuiz } from "./interactive-quiz";

interface QuizData {
  question: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
}

// Parse ::quiz markers and extract JSON blocks
function parseQuizBlocks(
  content: string
): Array<{ type: "text" | "quiz"; content: string; quiz?: QuizData }> {
  const parts: Array<{ type: "text" | "quiz"; content: string; quiz?: QuizData }> = [];
  const regex = /:::quiz\s*([\s\S]*?):::/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Text before quiz
    if (match.index > lastIdx) {
      parts.push({ type: "text", content: content.slice(lastIdx, match.index) });
    }
    // Parse quiz JSON
    try {
      const quiz: QuizData = JSON.parse(match[1]);
      parts.push({ type: "quiz", content: match[0], quiz });
    } catch {
      // If JSON is malformed, render as plain text
      parts.push({ type: "text", content: match[0] });
    }
    lastIdx = match.index + match[0].length;
  }

  // Remaining text
  if (lastIdx < content.length) {
    parts.push({ type: "text", content: content.slice(lastIdx) });
  }

  return parts;
}

export function ChatMessage({
  role,
  content,
  lessonId,
  hideQuizzes = false,
  onQuizDetected,
}: {
  role: "user" | "assistant";
  content: string;
  lessonId: string;
  hideQuizzes?: boolean;
  onQuizDetected?: (quiz: QuizData) => void;
}) {
  const reportedRef = useRef<Set<string>>(new Set());

  if (role === "user") {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  if (!content) return null;

  const parts = parseQuizBlocks(content);

  // Notify parent of new quizzes
  if (onQuizDetected) {
    for (const part of parts) {
      if (part.type === "quiz" && part.quiz) {
        const key = part.quiz.question;
        if (!reportedRef.current.has(key)) {
          reportedRef.current.add(key);
          onQuizDetected(part.quiz);
        }
      }
    }
  }

  return (
    <div className="prose prose-xs max-w-none">
      {parts.map((part, i) => {
        if (part.type === "quiz" && part.quiz) {
          if (hideQuizzes) {
            return (
              <div key={i} className="my-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Bài trắc nghiệm đã được chuyển vào bảng thông tin bên trên. Hãy trả lời tại đó.
              </div>
            );
          }
          return <InteractiveQuiz key={i} quiz={part.quiz} lessonId={lessonId} />;
        }
        return (
          <ReactMarkdown key={i} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
