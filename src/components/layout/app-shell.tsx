"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Clock, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "@/components/layout/sidebar";
import { Separator } from "@/components/ui/separator";
import { StreakBadge } from "@/components/gamification/streak-badge";
import { LessonInfoPanel } from "@/components/lessons/lesson-info-panel";
import { bridge } from "@/lib/study-session-bridge";
import { ActiveQuizProvider, useActiveQuiz } from "@/lib/active-quiz-context";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { SearchBar } from "@/components/search/search-bar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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
  const { user, logout } = useAuth();
  const timerRef = useRef<HTMLSpanElement>(null);
  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

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
          <Image src="/logo-Photoroom.png" alt="LMS" width={32} height={32} className="h-8 w-8 rounded-md object-cover" />
          <span className="text-lg font-bold text-gray-900">LMS</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <SearchBar />
        <StreakBadge />
        <NotificationDropdown />
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
        <div className="flex items-center gap-3 ml-2">
          {/* Name + Class (Stitch style) */}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {user?.fullName || "Người dùng"}
            </p>
            <p className="text-xs text-gray-500">
              {user?.classId ? `Lớp ${user.classId}` : user?.role || ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="cursor-pointer">
              <Avatar size="sm" className="ring-2 ring-primary/20">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{user?.fullName || "Người dùng"}</span>
                  <span className="text-xs text-muted-foreground">{user?.role || ""}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = "/profile"}>
              <User className="size-4" />
              Trang cá nhân
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4" />
              Đăng xuất
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          </div>
        </div>
      </header>
  );
}

// Extract lessonId from pathname like /courses/subjId/courseId/lessonId
function parseLessonPath(pathname: string): string | null {
  const match = pathname.match(/^\/courses\/[^/]+\/[^/]+\/([^/]+)/);
  return match ? match[1] : null;
}

function LessonInfoSidebar({ lessonId }: { lessonId: string }) {
  const { activeQuiz, handleQuizAnswered } = useActiveQuiz();

  return (
    <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-white sticky top-0 h-screen">
      <LessonInfoPanel
        lessonId={lessonId}
        activeQuiz={activeQuiz}
        onQuizAnswered={(result) => handleQuizAnswered(result)}
      />
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lessonId = parseLessonPath(pathname);
  const isLessonViewer = lessonId !== null;

  return (
    <ActiveQuizProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar — hidden on lesson viewer, replaced with lesson info */}
        {isLessonViewer && lessonId ? (
          <LessonInfoSidebar lessonId={lessonId} />
        ) : (
          <aside className="hidden lg:flex lg:w-[260px] lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-white sticky top-0 h-screen">
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
    </ActiveQuizProvider>
  );
}
