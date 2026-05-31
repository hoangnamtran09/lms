"use client";

import Link from "next/link";
import { Play, BookOpen, Calculator, Atom, FlaskConical, Globe, Palette, Music, Code, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  BookOpen, Calculator, Atom, FlaskConical, Globe, Palette, Music, Code,
};

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  gradeLevel?: number;
}

// Subtle pastel backgrounds matching the icon color
function hexToBg(hex: string): string {
  return hex ? `${hex}18` : "#4F46E518";
}

const gradeLabels: Record<number, string> = {
  10: "Khối 10", 11: "Khối 11", 12: "Khối 12",
};

export function SubjectCard({ subject }: { subject: Subject }) {
  const Icon = iconMap[subject.icon] || BookOpen;
  const bg = hexToBg(subject.color || "#4F46E5");
  const gradeLabel = subject.gradeLevel ? gradeLabels[subject.gradeLevel] || `Khối ${subject.gradeLevel}` : null;

  return (
    <Link
      href={`/courses/${subject.id}`}
      className="group flex flex-col rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    >
      {/* Icon + Badge row */}
      <div className="flex justify-between items-start mb-5">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
          style={{ backgroundColor: bg }}
        >
          <Icon className="size-7" style={{ color: subject.color || "#4F46E5" }} />
        </div>
        {gradeLabel && (
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: bg, color: subject.color || "#4F46E5" }}
          >
            {gradeLabel}
          </span>
        )}
      </div>

      {/* Title + Description */}
      <h3 className="text-xl font-bold text-gray-900 mb-1.5 group-hover:text-primary transition-colors">
        {subject.name}
      </h3>
      <p className="text-sm text-gray-500 mb-6 line-clamp-2 min-h-[2.5rem]">
        {subject.description || "Khám phá kiến thức mới trong môn học này."}
      </p>

      {/* CTA Button */}
      <div className="mt-auto">
        <span
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-95"
          style={{ backgroundColor: subject.color || "#4F46E5" }}
        >
          Học ngay
          <Play className="size-3.5 fill-white" />
        </span>
      </div>
    </Link>
  );
}

export function SubjectCardSkeleton() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 animate-pulse">
      <div className="flex justify-between items-start mb-5">
        <div className="h-14 w-14 rounded-2xl bg-gray-200" />
        <div className="h-6 w-16 rounded-full bg-gray-200" />
      </div>
      <div className="h-6 w-32 rounded bg-gray-200 mb-2" />
      <div className="h-4 w-full rounded bg-gray-100 mb-2" />
      <div className="h-4 w-3/4 rounded bg-gray-100 mb-6" />
      <div className="h-12 w-full rounded-xl bg-gray-200" />
    </div>
  );
}
