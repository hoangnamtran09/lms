"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, GraduationCap, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sidebar } from "@/components/layout/sidebar";
import { Separator } from "@/components/ui/separator";
import { StreakBadge } from "@/components/gamification/streak-badge";
import { LessonInfoPanel } from "@/components/lessons/lesson-info-panel";

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

function Header() {
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
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col">
          <LessonInfoPanel lessonId={lessonId} />
        </aside>
      ) : (
        <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-white">
          <Sidebar />
        </aside>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 px-4 py-6 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
