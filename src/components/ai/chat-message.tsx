"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { InteractiveQuiz } from "./interactive-quiz";
import { AiProgressBar } from "./ai-streaming-text";

interface QuizOption {
  text: string;
  isCorrect: boolean;
}

interface QuizData {
  question: string;
  options: { text: string }[];
  explanation: string;
}

function stripWeaknessMarkers(content: string): string {
  return content.replace(/:::weakness topic="[^"]*"/g, "");
}

function sanitizeLaTeXInJSON(jsonStr: string): string {
  return jsonStr.replace(/(?<!\\)\\([a-zA-Z]+)/g, "\\\\$1");
}

// Parse ::quiz markers and extract JSON blocks
function parseQuizBlocks(
  content: string
): Array<{ type: "text" | "quiz"; content: string; quiz?: QuizData }> {
  const cleaned = stripWeaknessMarkers(content);
  const parts: Array<{ type: "text" | "quiz"; content: string; quiz?: QuizData }> = [];
  const regex = /:::quiz\s*([\s\S]*?):::/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: "text", content: cleaned.slice(lastIdx, match.index) });
    }
    // Always sanitize LaTeX first — JSON escapes like \f, \r, \t, \n, \b
    // silently corrupt LaTeX commands like \frac, \rightarrow, \times, \neq, \beta
    const sanitized = sanitizeLaTeXInJSON(match[1]);
    let rawQuiz: { question: string; options: QuizOption[]; explanation: string } | undefined;
    try {
      rawQuiz = JSON.parse(sanitized);
    } catch {
      try {
        rawQuiz = JSON.parse(match[1]);
      } catch {}
    }
    if (rawQuiz) {
      parts.push({
        type: "quiz",
        content: match[0],
        quiz: {
          question: rawQuiz.question,
          options: rawQuiz.options.map((o) => ({ text: o.text })),
          explanation: rawQuiz.explanation,
        },
      });
    } else {
      parts.push({ type: "text", content: match[0] });
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < cleaned.length) {
    parts.push({ type: "text", content: cleaned.slice(lastIdx) });
  }

  return parts;
}

export function ChatMessage({
  role,
  content,
  lessonId,
  sessionId,
  hideQuizzes = false,
  onQuizDetected,
  onQuizAnswered,
  isStreaming = false,
}: {
  role: "user" | "assistant";
  content: string;
  lessonId: string;
  sessionId: string | null;
  hideQuizzes?: boolean;
  onQuizDetected?: (quiz: QuizData) => void;
  onQuizAnswered?: (result: { isCorrect: boolean; question: string }) => void;
  isStreaming?: boolean;
}) {
  const reportedRef = useRef<Set<string>>(new Set());

  const parts = parseQuizBlocks(content);

  useEffect(() => {
    if (!onQuizDetected) return;
    for (const part of parts) {
      if (part.type === "quiz" && part.quiz) {
        const key = part.quiz.question;
        if (!reportedRef.current.has(key)) {
          reportedRef.current.add(key);
          onQuizDetected(part.quiz);
        }
      }
    }
  }, [parts, onQuizDetected]);

  if (role === "user") {
    return (
      <p className="whitespace-pre-wrap">
        {content}
        {isStreaming && <span className="inline-block w-0.5 h-4 bg-primary animate-pulse align-middle ml-0.5" />}
      </p>
    );
  }

  if (!content) {
    if (isStreaming) {
      return (
        <div className="space-y-2 min-w-[220px]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">AI đang suy nghĩ</span>
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
          <AiProgressBar isStreaming={true} showLabel={false} />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="max-w-none [&_h2]:text-violet-700 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-indigo-600 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-gray-700 [&_p]:leading-relaxed [&_strong]:text-gray-900 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li]:text-gray-700 [&_code]:bg-violet-50 [&_code]:text-violet-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-sm [&_pre]:bg-gray-900 [&_pre]:text-gray-100 [&_pre]:rounded-xl [&_pre]:shadow-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-l-violet-400 [&_blockquote]:bg-violet-50/50 [&_blockquote]:rounded-r-lg [&_blockquote]:py-2 [&_blockquote]:px-4 [&_blockquote]:text-gray-700 [&_blockquote]:not-italic [&_a]:text-violet-600 [&_a]:font-medium [&_table]:w-full [&_table]:border-collapse [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_hr]:my-4 [&_hr]:border-gray-200">
      {parts.map((part, i) => {
        if (part.type === "quiz" && part.quiz) {
          if (hideQuizzes) {
            return (
              <div key={i} className="my-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Bài trắc nghiệm đã được chuyển vào bảng thông tin bên trái. Hãy trả lời tại đó.
              </div>
            );
          }
          return <InteractiveQuiz key={i} quiz={part.quiz} lessonId={lessonId} sessionId={sessionId} onAnswered={(isCorrect) => onQuizAnswered?.({ isCorrect, question: part.quiz!.question })} />;
        }
        const isLastText = i === parts.length - 1 || (i === parts.length - 2 && parts[parts.length - 1].type === "quiz");
        return (
          <span key={i}>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {part.content}
            </ReactMarkdown>
            {isStreaming && isLastText && (
              <span className="inline-block w-0.5 h-4 bg-violet-500 animate-pulse align-middle ml-0.5 rounded" />
            )}
          </span>
        );
      })}
    </div>
  );
}
