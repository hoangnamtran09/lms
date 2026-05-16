"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { apiStream } from "@/lib/api-client";
import ReactMarkdown from "react-markdown";

const weaknessRe = /:::weakness topic="[^"]*"/g;

function stripWeakness(content: string): string {
  return content.replace(weaknessRe, "");
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AITutorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId?: string;
  lessonTitle?: string;
}

export function AITutorPanel({ open, onOpenChange, lessonId, lessonTitle }: AITutorPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setError(null);

    const history = messages.filter((m) => m.content !== "");
    const userMsg: Message = { role: "user", content: text };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    apiStream(
      "/api/ai/chat",
      { message: text, lessonId: lessonId || "", sessionId: "", history },
      (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.length - 1;
          if (idx >= 0 && next[idx].role === "assistant") {
            next[idx] = { ...next[idx], content: next[idx].content + delta };
          }
          return next;
        });
      },
      () => setStreaming(false),
      (err) => {
        setError(err.message);
        setStreaming(false);
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetTitle className="sr-only">Trợ lý AI</SheetTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Trợ lý AI Tutor</h2>
            {lessonTitle && (
              <p className="text-xs text-gray-500 truncate max-w-[220px]">{lessonTitle}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" aria-label="Đóng" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="size-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {lessonTitle
                  ? `Hỏi tôi bất cứ điều gì về "${lessonTitle}"`
                  : "Hỏi tôi bất cứ điều gì bạn muốn học"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Tôi sẽ dùng phương pháp Socratic để dẫn dắt bạn
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-100 text-gray-900 prose prose-sm dark:prose-invert"
                }`}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{stripWeakness(msg.content) || (streaming && i === messages.length - 1 ? "..." : "")}</ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Nhập câu hỏi của bạn..."
              rows={2}
              className="min-h-0 resize-none text-sm"
              disabled={streaming}
            />
            <Button
              size="sm"
              onClick={send}
              disabled={!input.trim() || streaming}
              className="shrink-0 h-9 w-9 p-0"
            >
              {streaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
