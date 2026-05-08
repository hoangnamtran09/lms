"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, MessageCircle } from "lucide-react";
import { api, apiStream } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/ai/chat-message";

interface Lesson {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  courseId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function LessonViewerPage({
  params,
}: {
  params: Promise<{ subjectId: string; courseId: string; lessonId: string }>;
}) {
  const { subjectId, lessonId } = use(params);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Lesson>(`/api/lessons/${lessonId}`)
      .then(setLesson)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setChatError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);

    apiStream(
      "/api/ai/chat",
      { message: text, lessonId: lessonId, sessionId: "" },
      (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") last.content += delta;
          return [...copy];
        });
      },
      () => setStreaming(false),
      (err) => {
        setChatError(err.message);
        setStreaming(false);
      }
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-[70vh] rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-gray-500">{error || "Không tìm thấy bài giảng"}</p>
        <Link href={`/courses/${subjectId}`} className="mt-2 text-sm font-medium text-primary hover:underline">
          Quay lại danh sách bài học
        </Link>
      </div>
    );
  }

  const proxyUrl = lesson.mediaUrl ? `/api/media/pdf?url=${encodeURIComponent(lesson.mediaUrl)}` : null;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {!proxyUrl ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Bài học này chưa có tài liệu PDF.</p>
            <p className="text-sm text-gray-400 mt-1">Bạn vẫn có thể chat với AI bên dưới.</p>
            <Link href={`/courses/${subjectId}`} className="inline-flex items-center gap-2 mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              <ArrowLeft className="size-4" /> Quay lại
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
          {/* PDF viewer — left 2/3 */}
          <div className="lg:col-span-2 rounded-xl overflow-hidden ring-1 ring-foreground/10 bg-white min-h-0 relative">
            <Link
              href={`/courses/${subjectId}`}
              className="absolute top-3 left-3 z-10 inline-flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-gray-900 transition"
            >
              <ArrowLeft className="size-4" /> Quay lại
            </Link>
            <iframe
              src={proxyUrl}
              title={lesson.title}
              className="w-full h-full min-h-[50vh]"
            />
          </div>

          {/* AI Chat — right 1/3 */}
          <div className="rounded-xl ring-1 ring-foreground/10 bg-white flex flex-col min-h-0">
            <div className="px-4 py-3 border-b shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="size-4" /> Trợ lý AI
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="size-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Hỏi tôi về nội dung bài học</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-lg px-2.5 py-1.5 text-xs ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-900"
                  }`}>
                    {msg.role === "assistant" ? (
                      <ChatMessage
                        role="assistant"
                        content={msg.content || (streaming && i === messages.length - 1 ? "..." : "")}
                        lessonId={lessonId}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {chatError && <div className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{chatError}</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t px-3 py-2 shrink-0">
              <div className="flex gap-1.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  placeholder="Nhập câu hỏi..."
                  rows={2}
                  className="min-h-0 resize-none text-xs"
                  disabled={streaming}
                />
                <Button size="sm" onClick={send} disabled={!input.trim() || streaming} className="shrink-0 h-8 w-8 p-0">
                  {streaming ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
