"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ApiError, api } from "@/lib/api-client";

export const MIN_TOTAL_TIME = 60;
export const MIN_PAGES = 3;
export const MIN_PAGE_TIME = 10;

const HEARTBEAT_INTERVAL = 5000;

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
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initInFlightRef = useRef(false);
  const backendSyncDisabledRef = useRef(false);

  const stopLocalTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stopBackendTimers = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (retryRef.current) {
      clearInterval(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  useEffect(() => {
    visiblePagesRef.current = visiblePages;
  }, [visiblePages]);

  const stopAllTimers = useCallback(() => {
    stopBackendTimers();
    stopLocalTimer();
  }, [stopBackendTimers, stopLocalTimer]);

  const handleBackendUnavailable = useCallback(() => {
    backendSyncDisabledRef.current = true;
    stopBackendTimers();
  }, [stopBackendTimers]);

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
    if (initInFlightRef.current || sessionIdRef.current || backendSyncDisabledRef.current) return;
    initInFlightRef.current = true;

    try {
      const data = await api<{ id: string }>("/api/study-sessions/start", {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });
      sessionIdRef.current = data.id;
      setSessionId(data.id);
    } catch (e) {
      console.error("[study-timer] session start failed:", e);
    } finally {
      initInFlightRef.current = false;
    }
  }, [lessonId]);

  // Send heartbeat with visible pages
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current || backendSyncDisabledRef.current) return;
    heartbeatRef.current = setInterval(async () => {
      if (backendSyncDisabledRef.current) {
        stopBackendTimers();
        return;
      }
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
          handleBackendUnavailable();
          return;
        }
        console.error("[study-timer] heartbeat failed:", e);
      }
    }, HEARTBEAT_INTERVAL);
  }, [handleBackendUnavailable, stopBackendTimers]);

  const stopTimers = useCallback(() => {
    stopAllTimers();
  }, [stopAllTimers]);

  const endSession = useCallback(async () => {
    stopTimers();
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;
    setSessionId(null);
    if (backendSyncDisabledRef.current) return;
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
    if (backendSyncDisabledRef.current) return;
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
        startHeartbeat();
      });
    }, 0);
    if (!retryRef.current) {
      retryRef.current = setInterval(() => {
        if (!sessionIdRef.current && !backendSyncDisabledRef.current) {
          void initSession();
        }
      }, 5000);
    }
    return () => {
      window.clearTimeout(bootstrap);
      stopTimers();
      void endSession();
    };
  }, [active, initSession, startLocalTimer, startHeartbeat, stopTimers, endSession]);

  // Pause heartbeats on tab hidden, resume on visible
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.hidden) {
        stopTimers();
      } else {
        startLocalTimer();
        startHeartbeat();
        if (!retryRef.current && !backendSyncDisabledRef.current) {
          retryRef.current = setInterval(() => {
            if (!sessionIdRef.current && !backendSyncDisabledRef.current) {
              void initSession();
            }
          }, 5000);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, initSession, startHeartbeat, startLocalTimer, stopTimers]);

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
