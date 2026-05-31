"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { MaterialIcon } from "@/components/ui/material-icon";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  filled?: boolean;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", roles: ["PARENT", "STUDENT"] },
  { label: "Môn học", href: "/courses", icon: "menu_book", roles: ["STUDENT"] },
  { label: "Bài tập", href: "/assignments", icon: "assignment", roles: ["PARENT", "STUDENT"] },
  { label: "Bảng xếp hạng", href: "/leaderboard", icon: "leaderboard", roles: ["STUDENT"] },
  { label: "Điểm sai", href: "/mistakes", icon: "error", roles: ["STUDENT"] },
  { label: "Sơ đồ tư duy", href: "/mindmap", icon: "psychology", roles: ["STUDENT"] },
  { label: "Flashcards", href: "/flashcards", icon: "style", roles: ["STUDENT"] },
  { label: "Thành tựu", href: "/achievements", icon: "bookmark", filled: true, roles: ["STUDENT"] },
  { label: "Báo cáo tuần", href: "/reports", icon: "assessment", roles: ["STUDENT", "PARENT"] },
  // Teacher
  { label: "Tổng quan", href: "/teacher", icon: "co_present", roles: ["TEACHER"] },
  { label: "Môn học", href: "/teacher/courses", icon: "menu_book", roles: ["TEACHER"] },
  { label: "Bài tập", href: "/teacher/assignments", icon: "assignment", roles: ["TEACHER"] },
  { label: "Bảng xếp hạng", href: "/teacher/leaderboard", icon: "leaderboard", roles: ["TEACHER"] },
  { label: "Học sinh", href: "/teacher/students", icon: "group", roles: ["TEACHER"] },
  { label: "Phụ huynh", href: "/teacher/parents", icon: "family_restroom", roles: ["TEACHER"] },
  { label: "Báo cáo", href: "/teacher/reports", icon: "assessment", roles: ["TEACHER"] },
  { label: "Điểm yếu", href: "/teacher/mistakes", icon: "error", roles: ["TEACHER"] },
  { label: "Ngân hàng câu hỏi", href: "/teacher/question-bank", icon: "quiz", roles: ["TEACHER"] },
  { label: "Điểm danh", href: "/teacher/attendance", icon: "how_to_reg", roles: ["TEACHER"] },
  // Parent
  { label: "Phụ huynh", href: "/parent", icon: "family_restroom", roles: ["PARENT"] },
  { label: "Cài đặt", href: "/parent/settings", icon: "settings", roles: ["PARENT"] },
  // Admin
  { label: "Tổng quan", href: "/admin", icon: "admin_panel_settings", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí học sinh", href: "/admin/students", icon: "group", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí giáo viên", href: "/admin/teachers", icon: "co_present", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí môn học", href: "/admin/courses", icon: "library_books", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí lớp học", href: "/admin/classes", icon: "meeting_room", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí phụ huynh", href: "/admin/parents", icon: "family_restroom", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí bài tập", href: "/admin/assignments", icon: "fact_check", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí thành tựu", href: "/admin/achievements", icon: "bookmark", roles: ["SUPER_ADMIN", "ADMIN"] },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = allNavItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside className={cn("flex flex-col h-full py-6 bg-white", className)}>
      {/* Logo / Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <Image src="/logo-Photoroom.png" alt="LMS" width={20} height={20} className="h-5 w-5 rounded object-cover invert" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">LMS</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <MaterialIcon name={item.icon} filled={item.filled} className="text-[20px] shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User avatar at bottom */}
      <div className="px-6 mt-auto pt-4">
        <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-xs">
          {initials}
        </div>
      </div>
    </aside>
  );
}
