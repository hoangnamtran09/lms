"use client";

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
}: {
  role: "user" | "assistant";
  content: string;
  lessonId: string;
}) {
  if (role === "user") {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }

  if (!content) return null;

  const parts = parseQuizBlocks(content);

  return (
    <div className="prose prose-xs max-w-none">
      {parts.map((part, i) => {
        if (part.type === "quiz" && part.quiz) {
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
