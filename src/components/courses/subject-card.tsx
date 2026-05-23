import Link from "next/link";
import { BookOpen, Calculator, Atom, Microscope, Globe, Palette, Music, Code, type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  BookOpen, Calculator, Atom, Microscope, Globe, Palette, Music, Code,
};

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
}

export function SubjectCard({ subject }: { subject: Subject }) {
  const Icon = iconMap[subject.icon] || BookOpen;

  return (
    <Link
      href={`/courses/${subject.id}`}
      className="group block rounded-xl ring-1 ring-foreground/10 bg-white p-6 transition hover:shadow-lg hover:-translate-y-0.5"
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: subject.color + "20" }}
      >
        <Icon className="size-6" style={{ color: subject.color }} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors">
        {subject.name}
      </h3>
      {subject.description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{subject.description}</p>
      )}
    </Link>
  );
}

export function SubjectCardSkeleton() {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10 bg-white p-6 animate-pulse">
      <div className="mb-4 h-12 w-12 rounded-xl bg-gray-200" />
      <div className="h-5 w-24 rounded bg-gray-200" />
      <div className="mt-2 h-4 w-full rounded bg-gray-100" />
    </div>
  );
}
