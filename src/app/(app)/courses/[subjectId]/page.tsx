"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, FileVideo } from "lucide-react";
import { api } from "@/lib/api-client";

interface Subject {
  id: string;
  name: string;
}

interface Course {
  id: string;
  subjectId: string;
  title: string;
}

interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  mediaUrl?: string;
  sortOrder?: number;
}

export default function LessonListPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = use(params);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const subject = await api<Subject>(`/api/subjects/${subjectId}`);
      setSubject(subject);
      const courses = await api<Course[]>(`/api/courses?subjectId=${subjectId}`);
      const allLessons: Lesson[] = [];
      for (const c of courses) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        allLessons.push(...l);
      }
      allLessons.sort((a, b) => a.sortOrder !== undefined && b.sortOrder !== undefined ? a.sortOrder - b.sortOrder : 0);
      setLessons(allLessons);
    })().finally(() => setLoading(false));
  }, [subjectId]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4">
        <ArrowLeft className="size-4" />
        Tất cả môn học
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{subject?.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Danh sách bài học</p>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-500">Chưa có bài học nào trong môn này.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson, i) => (
            <Link
              key={lesson.id}
              href={`/courses/${subjectId}/${lesson.courseId}/${lesson.id}`}
              className="flex items-center gap-4 rounded-xl ring-1 ring-foreground/10 bg-white p-4 transition hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                {lesson.mediaUrl ? (
                  <FileVideo className="size-5 text-blue-600" />
                ) : (
                  <FileText className="size-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {lesson.title}
                </p>
                {lesson.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">{lesson.description}</p>
                )}
              </div>
              {lesson.durationMinutes ? (
                <span className="text-xs text-gray-400 shrink-0">
                  {lesson.durationMinutes} phút
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
