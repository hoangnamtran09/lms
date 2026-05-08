"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export const MIN_TOTAL_TIME = 60;
export const MIN_PAGES = 3;
export const MIN_PAGE_TIME = 10;

interface StudyProgress {
  elapsedSeconds: number;
  qualifiedPages: Set<number>;
  chatUnlocked: boolean;
  endSession: () => Promise<void>;
}

function sendTime(lessonId: string, elapsedSeconds: number) {
  fetch("/api/study-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, elapsedSeconds }),
    keepalive: true,
  }).catch(() => {});
}

function sendBeaconTime(lessonId: string, elapsedSeconds: number) {
  navigator.sendBeacon(
    "/api/study-sessions",
    new Blob(
      [JSON.stringify({ lessonId, elapsedSeconds })],
      { type: "application/json" },
    ),
  );
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
  const lastSentRef = useRef(0);

  useEffect(() => {
    visiblePagesRef.current = visiblePages;
  }, [visiblePages]);

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

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start/stop based on active
  useEffect(() => {
    if (!active) {
      stopTimer();
      return;
    }
    startTimer();
    return stopTimer;
  }, [active, startTimer, stopTimer]);

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

  // Heartbeat every 30s
  useEffect(() => {
    if (!active || !lessonId) return;
    const interval = setInterval(() => {
      const elapsed = elapsedRef.current;
      const delta = elapsed - lastSentRef.current;
      if (delta > 0) {
        sendTime(lessonId, delta);
        lastSentRef.current = elapsed;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [active, lessonId]);

  // Save on unmount / beforeunload
  useEffect(() => {
    if (!lessonId) return;
    const onBeforeUnload = () => {
      const delta = elapsedRef.current - lastSentRef.current;
      if (delta > 0) sendBeaconTime(lessonId, delta);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // flush remaining on unmount
      const delta = elapsedRef.current - lastSentRef.current;
      if (delta > 0) sendBeaconTime(lessonId, delta);
    };
  }, [lessonId]);

  const endSession = useCallback(async () => {
    stopTimer();
    const elapsed = elapsedRef.current;
    const delta = elapsed - lastSentRef.current;
    if (delta > 0) {
      await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, elapsedSeconds: delta }),
      });
      lastSentRef.current = elapsed;
    }
  }, [lessonId, stopTimer]);

  const chatUnlocked =
    elapsedSeconds >= MIN_TOTAL_TIME && qualifiedPages.size >= MIN_PAGES;

  return {
    elapsedSeconds,
    qualifiedPages,
    chatUnlocked,
    endSession,
  };
}
