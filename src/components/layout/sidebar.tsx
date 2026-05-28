"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BookOpen,
  BarChart3,
  Trophy,
  AlertCircle,
  Shield,
  Heart,
  UserCog,
  ScreenShare,
  Library,
  ClipboardCheck,
  Brain,
  Layers,
  Settings,
  Presentation,
  Award,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["PARENT", "STUDENT"] },
  { label: "Môn học", href: "/courses", icon: BookOpen, roles: ["STUDENT"] },
  { label: "Bài tập", href: "/assignments", icon: ClipboardList, roles: ["PARENT", "STUDENT"] },
  { label: "ảng xếp hạng", href: "/leaderboard", icon: Trophy, roles: ["STUDENT"] },
  { label: "Điểm sai", href: "/mistakes", icon: AlertCircle, roles: ["STUDENT"] },
  { label: "Sơ đồ tư duy", href: "/mindmap", icon: Brain, roles: ["STUDENT"] },
  { label: "Flashcards", href: "/flashcards", icon: Layers, roles: ["STUDENT"] },
  { label: "Thành tựu", href: "/achievements", icon: Award, roles: ["STUDENT"] },
  { label: "Báo cáo tuần", href: "/reports", icon: BarChart3, roles: ["STUDENT", "PARENT"] },
  // Teacher
  { label: "Tổng quan", href: "/teacher", icon: Presentation, roles: ["TEACHER"] },
  { label: "Môn học", href: "/teacher/courses", icon: BookOpen, roles: ["TEACHER"] },
  { label: "Bài tập", href: "/teacher/assignments", icon: ClipboardList, roles: ["TEACHER"] },
  { label: "Bảng xếp hạng", href: "/teacher/leaderboard", icon: Trophy, roles: ["TEACHER"] },
  { label: "Học sinh", href: "/teacher/students", icon: UserCog, roles: ["TEACHER"] },
  { label: "Phụ huynh", href: "/teacher/parents", icon: Heart, roles: ["TEACHER"] },
  { label: "Báo cáo", href: "/teacher/reports", icon: BarChart3, roles: ["TEACHER"] },
  { label: "Điểm yếu", href: "/teacher/mistakes", icon: AlertCircle, roles: ["TEACHER"] },
  { label: "Điểm danh", href: "/teacher/attendance", icon: ClipboardCheck, roles: ["TEACHER"] },
  // Parent
  { label: "Phụ huynh", href: "/parent", icon: Heart, roles: ["PARENT"] },
  { label: "Cài đặt", href: "/parent/settings", icon: Settings, roles: ["PARENT"] },
  // Admin
  { label: "Tổng quan", href: "/admin", icon: Shield, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí học sinh", href: "/admin/students", icon: UserCog, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí giáo viên", href: "/admin/teachers", icon: ScreenShare, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí môn học", href: "/admin/courses", icon: Library, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí lớp học", href: "/admin/classes", icon: Users, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí phụ huynh", href: "/admin/parents", icon: Heart, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí bài tập", href: "/admin/assignments", icon: ClipboardCheck, roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Quản lí thành tựu", href: "/admin/achievements", icon: Award, roles: ["SUPER_ADMIN", "ADMIN"] },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = allNavItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  return (
    <nav className={cn("flex flex-col gap-1 p-4", className)}>
      <div className="flex items-center gap-2 px-3 py-4">
        <img src="/logo-Photoroom.png" alt="LMS" className="h-8 w-8 rounded-md object-cover" />
        <span className="text-lg font-bold text-gray-900">LMS</span>
      </div>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
