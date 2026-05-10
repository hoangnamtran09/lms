"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/lib/api-client";

export const MIN_TOTAL_TIME = 60;
export const MIN_PAGES = 3;
export const MIN_PAGE_TIME = 10;

interface StudyProgress {
  elapsedSeconds: number;
  qualifiedPages: Set<number>;
  chatUnlocked: boolean;
  endSession: () => Promise<void>;
}

export function useStudyTimer(
  active: boolean,
  visiblePages: Set<number>,
  lessonId: string,
): StudyProgress {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [qualifiedPages, setQualifiedPages] = useState<Set<number>>(new Set());

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageTimeMapRef = useRef<Map<number, number>>(new Map());
  const visiblePagesRef = useRef(visiblePages);
  const elapsedRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    visiblePagesRef.current = visiblePages;
  }, [visiblePages]);

  const startSession = useCallback(async () => {
    try {
      const data = await api<{ id: string }>("/api/study-sessions/start", {
        method: "POST",
        body: JSON.stringify({ lessonId }),
      });
      sessionIdRef.current = data.id;
    } catch {}
  }, [lessonId]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    stopTimer();
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await api(`/api/study-sessions/${sid}/end`, { method: "POST" });
      sessionIdRef.current = null;
    } catch {}
  }, [stopTimer]);

  const startTimer = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        return next;
      });

      const map = pageTimeMapRef.current;
      const vis = visiblePagesRef.current;
      const newlyQualified: number[] = [];

      for (const p of vis) {
        const t = (map.get(p) || 0) + 1;
        map.set(p, t);
        if (t >= MIN_PAGE_TIME) newlyQualified.push(p);
      }

      if (newlyQualified.length > 0) {
        setQualifiedPages((prev) => {
          const next = new Set(prev);
          for (const p of newlyQualified) next.add(p);
          return next;
        });
      }
    }, 1000);
  }, []);

  // Start/stop based on active
  useEffect(() => {
    if (!active) {
      stopTimer();
      return;
    }
    startTimer();
    startSession();
    return () => { stopTimer(); };
  }, [active, startTimer, stopTimer, startSession]);

  // Pause on tab hidden
  useEffect(() => {
    if (!active) return;
    const onVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, startTimer, stopTimer]);

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

  const chatUnlocked =
    elapsedSeconds >= MIN_TOTAL_TIME && qualifiedPages.size >= MIN_PAGES;

  return {
    elapsedSeconds,
    qualifiedPages,
    chatUnlocked,
    endSession,
  };
}
