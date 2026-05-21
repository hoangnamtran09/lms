"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, FileText, FileVideo } from "lucide-react";
import { api, fetchList } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

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
  mediaUrl?: string;
  studied?: boolean;
}

const PAGE_SIZE = 20;

export default function LessonListPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = use(params);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [subjectId]);

  useEffect(() => {
    (async () => {
      const subject = await api<Subject>(`/api/subjects/${subjectId}`);
      setSubject(subject);
      const courses = await fetchList<Course>(`/api/courses?subjectId=${subjectId}`);
      const lessons: Lesson[] = [];
      for (const c of courses) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        lessons.push(...l);
      }
      lessons.sort((a, b) => {
        const na = parseInt((a.title.match(/\d+/) || [""])[0]) || 0;
        const nb = parseInt((b.title.match(/\d+/) || [""])[0]) || 0;
        return na - nb;
      });
      setAllLessons(lessons);
    })().finally(() => setLoading(false));
  }, [subjectId]);

  const totalPages = Math.max(1, Math.ceil(allLessons.length / PAGE_SIZE));
  const lessons = allLessons.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      <Link href="/courses" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4">
        <ArrowLeft className="size-4" />
        Tất cả môn học
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{subject?.name}</h1>
      <p className="text-sm text-gray-500 mb-6">Danh sách bài học</p>

      {allLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-500">Chưa có bài học nào trong môn này.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {lessons.map((lesson) => (
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
          {totalPages > 1 && (
            <Pagination page={page} limit={PAGE_SIZE} total={allLessons.length} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
