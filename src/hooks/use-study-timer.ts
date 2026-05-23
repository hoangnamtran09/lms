"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";

export const MIN_TOTAL_TIME = 60;
export const MIN_PAGES = 3;
export const MIN_PAGE_TIME = 10;

const HEARTBEAT_INTERVAL = 5000;
const POLL_INTERVAL = 2000;

interface SessionStatus {
  elapsedSeconds: number;
  qualifiedPages: number[];
  chatUnlocked: boolean;
}

interface StudyProgress {
  elapsedSeconds: number;
  qualifiedPages: Set<number>;
  chatUnlocked: boolean;
  endSession: () => Promise<void>;
  cancelSession: () => Promise<void>;
}

export function useStudyTimer(
  active: boolean,
  visiblePages: Set<number>,
  lessonId: string,
): StudyProgress {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [qualifiedPages, setQualifiedPages] = useState<Set<number>>(new Set());
  const [chatUnlocked, setChatUnlocked] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const visiblePagesRef = useRef(visiblePages);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    visiblePagesRef.current = visiblePages;
  }, [visiblePages]);

  // Start or resume session
  const initSession = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    try {
      // Check for existing active session first
      const existing = await api<{ id: string } | null>(
        `/api/study-sessions/active?lessonId=${lessonId}`,
      );
      if (existing?.id) {
        sessionIdRef.current = existing.id;
        return;
      }
    } catch {}

    try {
      const data = await api<{ id: string }>("/api/study-sessions/start", {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });
      sessionIdRef.current = data.id;
    } catch {}
  }, [lessonId]);

  // Poll session status from server
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const status = await api<SessionStatus>(`/api/study-sessions/${sid}/status`);
        setElapsedSeconds(status.elapsedSeconds);
        setQualifiedPages(new Set(status.qualifiedPages));
        setChatUnlocked(status.chatUnlocked);
      } catch {}
    }, POLL_INTERVAL);
  }, []);

  // Send heartbeat with visible pages
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        await api(`/api/study-sessions/${sid}/heartbeat?interval=5`, {
          method: "POST",
          body: JSON.stringify({
            visiblePages: Array.from(visiblePagesRef.current),
          }),
        });
      } catch {}
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    stopTimers();
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await api(`/api/study-sessions/${sid}/end`, { method: "POST" });
      sessionIdRef.current = null;
    } catch {}
  }, [stopTimers]);

  const cancelSession = useCallback(async () => {
    stopTimers();
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await api(`/api/study-sessions/${sid}`, { method: "DELETE" });
      sessionIdRef.current = null;
    } catch {}
  }, [stopTimers]);

  // Main lifecycle
  useEffect(() => {
    if (!active) {
      stopTimers();
      endSession();
      startedRef.current = false;
      return;
    }
    initSession().then(() => {
      startPolling();
      startHeartbeat();
    });
    return () => {
      stopTimers();
      endSession();
    };
  }, [active, initSession, startPolling, startHeartbeat, stopTimers, endSession]);

  // Pause heartbeats on tab hidden, resume on visible
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.hidden) {
        stopTimers();
      } else {
        startPolling();
        startHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, startPolling, startHeartbeat, stopTimers]);

  // End session on beforeunload
  useEffect(() => {
    const onBeforeUnload = () => {
      const sid = sessionIdRef.current;
      if (sid) {
        navigator.sendBeacon(
          `/api/study-sessions/${sid}/end`,
          new Blob([""], { type: "application/json" }),
        );
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return {
    elapsedSeconds,
    qualifiedPages,
    chatUnlocked,
    endSession,
    cancelSession,
  };
}
