"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ApiError, api } from "@/lib/api-client";

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
  sessionId: string | null;
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [qualifiedPages, setQualifiedPages] = useState<Set<number>>(new Set());

  const sessionIdRef = useRef<string | null>(null);
  const visiblePagesRef = useRef(visiblePages);
  const localElapsedRef = useRef(0);
  const pageTimeRef = useRef<Map<number, number>>(new Map());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initInFlightRef = useRef(false);

  const clearLocalSession = useCallback(() => {
    sessionIdRef.current = null;
    setSessionId(null);
    setElapsedSeconds(0);
    localElapsedRef.current = 0;
    setQualifiedPages(new Set());
    pageTimeRef.current.clear();
  }, []);

  const stopActiveTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    visiblePagesRef.current = visiblePages;
  }, [visiblePages]);

  const handleMissingSession = useCallback(() => {
    stopActiveTimers();
    clearLocalSession();
  }, [clearLocalSession, stopActiveTimers]);

  const stopRetryTimer = useCallback(() => {
    if (retryRef.current) {
      clearInterval(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const syncSessionStatus = useCallback(async (sessionId: string) => {
    try {
      const status = await api<SessionStatus>(`/api/study-sessions/${sessionId}/status`);
      setElapsedSeconds((current) => {
        const next = Math.max(current, status.elapsedSeconds);
        localElapsedRef.current = next;
        return next;
      });
      setQualifiedPages((current) => {
        const next = new Set(current);
        status.qualifiedPages.forEach((page) => next.add(page));
        return next;
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        handleMissingSession();
        return;
      }
      console.error("[study-timer] status sync failed:", e);
    }
  }, [handleMissingSession]);

  const startLocalTimer = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      localElapsedRef.current += 1;
      setElapsedSeconds(localElapsedRef.current);

      const visiblePagesNow = Array.from(visiblePagesRef.current);
      if (visiblePagesNow.length === 0) return;

      setQualifiedPages((current) => {
        const next = new Set(current);
        for (const page of visiblePagesNow) {
          const seconds = (pageTimeRef.current.get(page) ?? 0) + 1;
          pageTimeRef.current.set(page, seconds);
          if (seconds >= MIN_PAGE_TIME) {
            next.add(page);
          }
        }
        return next;
      });
    }, 1000);
  }, []);

  // Start or resume session
  const initSession = useCallback(async () => {
    if (initInFlightRef.current || sessionIdRef.current) return;
    initInFlightRef.current = true;

    try {
      const existing = await api<{ id: string } | null>(
        `/api/study-sessions/active?lessonId=${lessonId}`,
      );
      if (existing?.id) {
        sessionIdRef.current = existing.id;
        setSessionId(existing.id);
        await syncSessionStatus(existing.id);
        return;
      }
    } catch (e) {
      console.error("[study-timer] active session check failed:", e);
    }

    try {
      const data = await api<{ id: string }>("/api/study-sessions/start", {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });
      sessionIdRef.current = data.id;
      setSessionId(data.id);
      await syncSessionStatus(data.id);
    } catch (e) {
      console.error("[study-timer] session start failed:", e);
    } finally {
      initInFlightRef.current = false;
    }
  }, [lessonId, syncSessionStatus]);

  // Poll session status from server
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      await syncSessionStatus(sid);
    }, POLL_INTERVAL);
  }, [syncSessionStatus]);

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
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          handleMissingSession();
          return;
        }
        console.error("[study-timer] heartbeat failed:", e);
      }
    }, HEARTBEAT_INTERVAL);
  }, [handleMissingSession]);

  const stopTimers = useCallback(() => {
    stopActiveTimers();
    stopRetryTimer();
  }, [stopActiveTimers, stopRetryTimer]);

  const endSession = useCallback(async () => {
    stopTimers();
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    setSessionId(null);
    try {
      await api(`/api/study-sessions/${sid}/end`, { method: "POST" });
    } catch (e) {
      console.error("[study-timer] end session failed:", e);
    }
  }, [stopTimers]);

  const cancelSession = useCallback(async () => {
    stopTimers();
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    setSessionId(null);
    try {
      await api(`/api/study-sessions/${sid}`, { method: "DELETE" });
    } catch (e) {
      console.error("[study-timer] cancel session failed:", e);
    }
  }, [stopTimers]);

  // Main lifecycle
  useEffect(() => {
    if (!active) {
      stopTimers();
      endSession();
      return;
    }
    startLocalTimer();
    const bootstrap = window.setTimeout(() => {
      void initSession().then(() => {
        startPolling();
        startHeartbeat();
      });
    }, 0);
    if (!retryRef.current) {
      retryRef.current = setInterval(() => {
        if (!sessionIdRef.current) {
          void initSession();
        }
      }, 5000);
    }
    return () => {
      window.clearTimeout(bootstrap);
      stopTimers();
      endSession();
    };
  }, [active, initSession, startLocalTimer, startPolling, startHeartbeat, stopTimers, endSession]);

  // Pause heartbeats on tab hidden, resume on visible
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.hidden) {
        stopActiveTimers();
      } else {
        startPolling();
        startHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, startPolling, startHeartbeat, stopActiveTimers]);

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
    sessionId,
    elapsedSeconds,
    qualifiedPages,
    chatUnlocked: elapsedSeconds >= MIN_TOTAL_TIME && qualifiedPages.size >= MIN_PAGES,
    endSession,
    cancelSession,
  };
}
