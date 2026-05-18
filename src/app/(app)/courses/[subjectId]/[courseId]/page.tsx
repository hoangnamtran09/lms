"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, FileText } from "lucide-react";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Course {
  id: string;
  title: string;
  subjectId: string;
}

interface Lesson {
  id: string;
  title: string;
  description?: string;
  mediaUrl?: string;
  studied?: boolean;
}

export default function LessonListPage({
  params,
}: {
  params: Promise<{ subjectId: string; courseId: string }>;
}) {
  const { subjectId, courseId } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<Course>(`/api/courses/${courseId}`),
      api<Lesson[]>(`/api/lessons?courseId=${courseId}`),
    ])
      .then(([c, l]) => {
        setCourse(c);
        l.sort((a, b) => {
          const na = parseInt((a.title.match(/\d+/) || [""])[0]) || 0;
          const nb = parseInt((b.title.match(/\d+/) || [""])[0]) || 0;
          return na - nb;
        });
        setLessons(l);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} delay={100 + i * 80} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href={`/courses/${subjectId}`} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4">
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{course?.title}</h1>
      <p className="text-sm text-gray-500 mb-6">Danh sách bài giảng</p>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-500">Chưa có bài giảng nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/courses/${subjectId}/${courseId}/${lesson.id}`}
              className="flex items-center gap-4 rounded-xl ring-1 ring-foreground/10 bg-white p-4 transition hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <FileText className="size-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {lesson.title}
                  </p>
                  {lesson.studied !== undefined && (
                    lesson.studied ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="size-3" />
                        Đã học
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        <Circle className="size-3" />
                        Chưa học
                      </span>
                    )
                  )}
                </div>
                {lesson.description && (
                  <p className="text-xs text-gray-500 line-clamp-1">{lesson.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
