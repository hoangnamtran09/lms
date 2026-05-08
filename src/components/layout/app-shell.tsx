"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, GraduationCap, Bell, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "@/components/layout/sidebar";
import { Separator } from "@/components/ui/separator";
import { StreakBadge } from "@/components/gamification/streak-badge";
import { LessonInfoPanel } from "@/components/lessons/lesson-info-panel";
import { bridge } from "@/lib/study-session-bridge";

function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-4" />
      </Button>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar />
      </SheetContent>
    </Sheet>
  );
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Header({ isLessonViewer }: { isLessonViewer: boolean }) {
  const timerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isLessonViewer) return;
    const interval = setInterval(() => {
      const s = bridge.getElapsed?.() ?? 0;
      if (timerRef.current) {
        timerRef.current.textContent = formatElapsed(s);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLessonViewer]);

  const handleEnd = () => {
    bridge.endSession?.();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="lg:hidden">
          <MobileSidebar />
        </div>
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <GraduationCap className="size-5 text-gray-900" />
          <span className="text-lg font-bold text-gray-900">LMS</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <StreakBadge />
        <Button variant="ghost" size="sm" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        {isLessonViewer && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1">
            <Clock className="size-3.5 text-primary" />
            <span ref={timerRef} className="tabular-nums text-sm font-semibold text-primary">0:00</span>
            <Separator orientation="vertical" className="h-4" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEnd}
              className="h-6 text-xs font-medium text-primary hover:bg-primary/20 -mx-1"
            >
              Kết thúc học
            </Button>
          </div>
        )}
        <Avatar size="sm">
          <AvatarFallback className="text-xs">AD</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

// Extract lessonId from pathname like /courses/subjId/courseId/lessonId
function parseLessonPath(pathname: string): string | null {
  const match = pathname.match(/^\/courses\/[^/]+\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lessonId = parseLessonPath(pathname);
  const isLessonViewer = lessonId !== null;

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar — hidden on lesson viewer, replaced with lesson info */}
      {isLessonViewer ? (
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-white sticky top-0 h-screen">
          <LessonInfoPanel lessonId={lessonId} />
        </aside>
      ) : (
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-white sticky top-0 h-screen">
          <Sidebar />
        </aside>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header isLessonViewer={isLessonViewer} />
        <main className="flex-1 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
