"use client";

import { useEffect, useState, useRef } from "react";

// ── AiProgressBar ──
// Auto-advancing progress bar that smoothly climbs to ~95% then waits
export function AiProgressBar({ isStreaming, showLabel = true }: { isStreaming: boolean; showLabel?: boolean }) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      setProgress(100);
      return;
    }
    setProgress(0);

    // Speed: fast at start, slows down as it approaches 90%
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev; // hold near 92% until stream ends
        const increment = Math.max(0.3, (92 - prev) * 0.08);
        return Math.min(92, prev + increment);
      });
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming]);

  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-gray-400 mb-1">
        {showLabel ? <span>Đang xử lý</span> : <span />}
        <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-violet-400 via-violet-500 to-purple-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── AiTypingDots ──
// Animated 3-dot typing indicator while waiting for AI to start responding
export function AiTypingDots() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-2xl max-w-[120px]">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2.5 rounded-full bg-gray-400 animate-bounce"
            style={{
              animationDelay: `${i * 150}ms`,
              animationDuration: "0.8s",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── StreamingText ──
// Shows text with a blinking cursor, glow effect while streaming
export function StreamingText({
  text,
  isStreaming,
  className = "",
}: {
  text: string;
  isStreaming: boolean;
  className?: string;
}) {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (!isStreaming) {
      setCursorVisible(false);
      return;
    }
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [isStreaming]);

  if (!text && !isStreaming) return null;

  return (
    <div className={className}>
      {/* Glow ring while streaming */}
      {isStreaming && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-400/30 animate-pulse pointer-events-none" />
      )}
      <span className="whitespace-pre-wrap leading-relaxed">{text || ""}</span>
      {isStreaming && (
        <span
          className={`inline-block w-0.5 h-[1.1em] bg-blue-500 ml-0.5 align-text-bottom rounded-full transition-opacity duration-100 ${
            cursorVisible ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

// ── AiThinkingBubble ──
// Combined: typing dots + thinking label with subtle pulse glow
export function AiThinkingBubble({ label = "AI đang suy nghĩ" }: { label?: string }) {
  return (
    <div className="flex items-start gap-3 max-w-[360px]">
      {/* Avatar glow */}
      <div className="relative shrink-0">
        <div className="absolute inset-0 size-8 rounded-full bg-blue-400/30 animate-ping" />
        <div className="relative size-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      </div>
      {/* Bubble */}
      <div className="flex-1 relative bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="absolute -left-1 top-0 w-3 h-3 bg-gray-100 rotate-45" />
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-gray-500 font-medium">{label}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.7s" }}
              />
            ))}
          </div>
        </div>
        <AiProgressBar isStreaming={true} />
      </div>
    </div>
  );
}
