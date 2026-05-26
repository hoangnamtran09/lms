"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, MessageCircle, GripVertical, Lock } from "lucide-react";
import { api, apiStream } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/ai/chat-message";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useStudyTimer, MIN_TOTAL_TIME, MIN_PAGES, MIN_PAGE_TIME } from "@/hooks/use-study-timer";
import { bridge } from "@/lib/study-session-bridge";
import { useActiveQuiz, type QuizData } from "@/lib/active-quiz-context";
import { playAIResponseSound, playCorrectAnswerSound } from "@/lib/notification-sound";
import { CompletionQuizDialog } from "@/components/ai/completion-quiz-dialog";
import type { QuizQuestion } from "@/components/ai/completion-quiz-dialog";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[] | null>(null);
  const { activeQuiz, setActiveQuiz, lastQuizResult, clearLastQuizResult } = useActiveQuiz();
  const quizBlocked = activeQuiz !== null;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasHistory, setHasHistory] = useState(false);

  // Chat history is now saved server-side in the AI handler

  // Load chat history on mount
  useEffect(() => {
    api<{ messages: { role: string; content: string }[] }>(
      `/api/ai/chat-history?lessonId=${lessonId}`
    ).then((data) => {
      const msgs: Message[] = data.messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      if (msgs.length > 0) {
        setMessages(msgs);
        setHasHistory(true);
      }
    }).catch(() => {});
  }, [lessonId]);

  // PDF state
  const [numPages, setNumPages] = useState(0);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
  const proxyUrl = lesson?.mediaUrl
    ? `${API_BASE}/api/media/pdf?url=${encodeURIComponent(lesson.mediaUrl)}`
    : null;

  // Study timer
  const {
    sessionId,
    elapsedSeconds,
    qualifiedPages,
    chatUnlocked: timerChatUnlocked,
    endSession,
    cancelSession,
  } = useStudyTimer(true, visiblePages, lessonId);

  const chatUnlocked = timerChatUnlocked || hasHistory;

  const elapsedRef = useRef(elapsedSeconds);
  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  });

  // Register bridge handlers
  const router = useRouter();
  useEffect(() => {
    bridge.getElapsed = () => elapsedRef.current;
    bridge.getSessionId = () => sessionId;
    bridge.endSession = () => {
      setShowQuiz(true);
    };
    return () => {
      bridge.getElapsed = null;
      bridge.getSessionId = null;
      bridge.endSession = null;
    };
  }, [sessionId]);

  // Auto-trigger AI greeting when chat unlocks
  const greetingSentRef = useRef(false);
  useEffect(() => {
    if (chatUnlocked && !greetingSentRef.current && !streaming && !hasHistory) {
      greetingSentRef.current = true;
      // Gửi tin nhắn trống để AI chủ động chào và dẫn dắt
      setMessages([{ role: "assistant", content: "" }]);
      setStreaming(true);
      apiStream(
        "/api/ai/chat",
        { message: "Xin chào", lessonId: lessonId, subjectId, sessionId: sessionId ?? "", history: [] },
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
        () => {
          setStreaming(false);
          playAIResponseSound();
        },
        (err) => {
          setChatError(err.message);
          setStreaming(false);
        }
      );
    }
  }, [chatUnlocked, streaming, lessonId, sessionId, subjectId, hasHistory]);

  // PDF container width for page sizing
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState(0);
  useEffect(() => {
    const el = pdfContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setPdfWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Track visible pages via scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || numPages === 0) return;

    const updateVisible = () => {
      const canvases = el.querySelectorAll("canvas");
      if (canvases.length === 0) return;
      const containerRect = el.getBoundingClientRect();
      const next = new Set<number>();
      canvases.forEach((canvas, i) => {
        const rect = canvas.getBoundingClientRect();
        const visibleTop = Math.max(rect.top, containerRect.top);
        const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        if (visibleHeight >= rect.height * 0.3) {
          next.add(i + 1);
        }
      });
      if (next.size > 0) setVisiblePages(next);
    };

    el.addEventListener("scroll", updateVisible, { passive: true });
    const timer = setTimeout(updateVisible, 500);
    return () => {
      el.removeEventListener("scroll", updateVisible);
      clearTimeout(timer);
    };
  }, [numPages]);

  // Resize state
  const [splitRatio, setSplitRatio] = useState(60);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Lesson>(`/api/lessons/${lessonId}`)
      .then(setLesson)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  // Preload quiz questions
  useEffect(() => {
    api<{ questions: QuizQuestion[] }>("/api/ai/completion-quiz", {
      method: "POST",
      body: JSON.stringify({ lessonId, subjectId, sessionId: sessionId ?? "", questionCount: 5 }),
    })
      .then((data) => {
        if (data.questions?.length) setQuizQuestions(data.questions);
      })
      .catch(() => {});
  }, [lessonId, sessionId, subjectId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(30, pct)));
    };
    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Quiz detection from AI response
  const handleQuizDetected = useCallback((quiz: QuizData) => {
    setActiveQuiz(quiz);
  }, [setActiveQuiz]);

  const sendMessage = useCallback((text: string) => {
    setChatError(null);
    let prevMessages: Message[] = [];
    setMessages((prev) => {
      prevMessages = prev.filter((m) => m.content !== "");
      return [...prev, { role: "user", content: text }, { role: "assistant", content: "" }];
    });
    setStreaming(true);

    apiStream(
      "/api/ai/chat",
      { message: text, lessonId: lessonId, sessionId: sessionId ?? "", history: prevMessages },
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
      () => {
        setStreaming(false);
        playAIResponseSound();
      },
      (err) => {
        setChatError(err.message);
        setStreaming(false);
      }
    );
  }, [lessonId, sessionId]);

  const send = () => {
    const text = input.trim();
    if (!text || streaming || quizBlocked) return;

    setInput("");
    sendMessage(text);
  };

  // Auto-continue chat after quiz answered
  useEffect(() => {
    if (lastQuizResult !== null && !streaming && chatUnlocked) {
      const { isCorrect, question } = lastQuizResult;
      const shortQuestion = question.length > 80 ? question.slice(0, 80) + "..." : question;
      const msg = isCorrect
        ? `Mình vừa trả lời đúng câu hỏi "${shortQuestion}".`
        : `Mình vừa trả lời sai câu hỏi "${shortQuestion}". Hãy giải thích giúp mình nhé.`;
      if (isCorrect) playCorrectAnswerSound();
      clearLastQuizResult();
      // Avoid calling setState synchronously within an effect — defer the send
      setTimeout(() => sendMessage(msg), 0);
    }
  }, [lastQuizResult, streaming, chatUnlocked, clearLastQuizResult, sendMessage]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={120} className="h-[70vh] rounded-xl" />
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

  return (
    <>
    <div className="animate-fade-in flex flex-col -my-6 -mx-4 lg:-mx-6 h-[calc(100vh-3.5rem)] w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] min-h-0 overflow-hidden">
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
        <div ref={containerRef} className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
          {/* Overlay blocks iframe during drag */}
          {isDragging && (
            <div className="absolute inset-0 z-20" style={{ cursor: "col-resize" }} />
          )}

          {/* PDF viewer */}
          <div
            ref={pdfContainerRef}
            className="overflow-hidden bg-white min-h-0 relative lg:border-r flex flex-col"
            style={{ flexBasis: `${splitRatio}%` }}
          >
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <button
                onClick={() => {
                  cancelSession();
                  router.push(`/courses/${subjectId}`);
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/90 backdrop-blur px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-white hover:text-gray-900 transition"
              >
                <ArrowLeft className="size-4" /> Quay lại
              </button>

            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto flex justify-center pt-12 pb-4"
            >
              <Document
                file={proxyUrl}
                onLoadSuccess={({ numPages: np }) => setNumPages(np)}
                loading={
                  <div className="flex items-center justify-center pt-12">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 w-32 rounded bg-gray-200 mx-auto" />
                      <div className="h-[60vh] w-[45vh] rounded bg-gray-100" />
                    </div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center pt-12 text-sm text-red-500">
                    Không thể tải tài liệu PDF
                  </div>
                }
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <Page
                    key={i + 1}
                    pageNumber={i + 1}
                    width={pdfWidth > 0 ? pdfWidth - 32 : undefined}
                  />
                ))}
              </Document>
            </div>
          </div>

          {/* Drag handle */}
          <div
            className="hidden lg:flex w-4 shrink-0 cursor-col-resize items-center justify-center group relative -mx-1 z-10"
            onMouseDown={handleMouseDown}
          >
            <div className="w-0.5 h-full bg-gray-200 group-hover:bg-primary/40 group-active:bg-primary/60 transition-colors rounded-full" />
            <GripVertical className="absolute size-3 text-gray-300 group-hover:text-primary/50 pointer-events-none" />
          </div>

          {/* AI Chat */}
          <div className="bg-white flex flex-col min-h-0 flex-1 min-w-0">
            <div className="px-4 py-3 border-b shrink-0 bg-gradient-to-r from-violet-50 to-purple-50">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
                  AI
                </div>
                Gia sư AI
              </h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                    <MessageCircle className="size-7 text-violet-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Gia sư AI sẵn sàng giúp bạn</p>
                  <p className="text-xs text-gray-400 mt-1">Hãy đọc tài liệu để mở khoá chat</p>
                </div>
              )}
              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1;
                const isStreamingThis = isLast && streaming;
                return (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className={`shrink-0 mt-1 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ${isStreamingThis ? "animate-pulse" : ""}`}>
                      AI
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : `bg-gradient-to-br from-violet-50 to-purple-50 text-gray-800 rounded-bl-md border shadow-sm ${isStreamingThis ? "border-violet-300" : "border-violet-100"}`
                  }`}>
                    {msg.role === "assistant" ? (
                      <ChatMessage
                        role="assistant"
                        content={msg.content}
                        lessonId={lessonId}
                        sessionId={sessionId}
                        hideQuizzes={true}
                        onQuizDetected={handleQuizDetected}
                        isStreaming={isStreamingThis}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="shrink-0 mt-1 w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                      B
                    </div>
                  )}
                </div>
                );
              })}
              {chatError && <div className="rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{chatError}</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Input / Lock */}
            {!chatUnlocked ? (
              <div className="border-t px-3 py-2 shrink-0 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <Lock className="size-3" />
                  <span>Hãy đọc bài để mở khoá trợ lý AI</span>
                </div>

                {/* Time progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Thời gian đọc bài</span>
                    <span className="tabular-nums">{elapsedSeconds}/{MIN_TOTAL_TIME}s</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (elapsedSeconds / MIN_TOTAL_TIME) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Page progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Số trang đã đọc (≥{MIN_PAGE_TIME}s/trang)</span>
                    <span className="tabular-nums">{qualifiedPages.size}/{MIN_PAGES}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (qualifiedPages.size / MIN_PAGES) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t px-3 py-2 shrink-0">
                {quizBlocked && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 mb-2">
                    <Lock className="size-3" />
                    <span>Hãy trả lời câu hỏi trắc nghiệm phía trên để tiếp tục chat</span>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    placeholder={quizBlocked ? "Trả lời câu hỏi phía trên trước..." : "Nhập câu hỏi..."}
                    rows={2}
                    className="min-h-0 resize-none text-xs"
                    disabled={streaming || quizBlocked}
                  />
                  <Button size="sm" onClick={send} disabled={!input.trim() || streaming || quizBlocked} className="shrink-0 h-8 w-8 p-0">
                    {streaming ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      <CompletionQuizDialog
        open={showQuiz}
        lessonId={lessonId}
        subjectId={subjectId}
        sessionId={sessionId}
        preloadedQuestions={quizQuestions}
        onComplete={async () => {
          setShowQuiz(false);
          await endSession();
          try {
            await api("/api/diamonds/earn", {
              method: "POST",
              body: JSON.stringify({ lessonId, durationSeconds: elapsedSeconds }),
            });
          } catch {} // Non-critical
          router.push(`/courses/${subjectId}`);
        }}
      />
    </>
  );
}
