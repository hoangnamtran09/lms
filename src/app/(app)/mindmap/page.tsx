"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, BookOpen, ChevronRight, ArrowUpRight } from "lucide-react";

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  gradeLevel: number;
}

interface Course {
  id: string;
  subjectId: string;
  title: string;
  gradeLevel: number;
}

interface Lesson {
  id: string;
  courseId: string;
  title: string;
}

export default function MindMapPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Record<string, Course[]>>({});
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [subjData] = await Promise.allSettled([
          api<Subject[]>("/api/subjects"),
        ]);
        const subjList = subjData.status === "fulfilled" ? subjData.value : [];
        setSubjects(subjList);

        const courseMap: Record<string, Course[]> = {};
        const lessonMap: Record<string, Lesson[]> = {};
        for (const s of subjList) {
          try {
            const cData = await api<Course[]>(`/api/courses?subjectId=${s.id}`);
            courseMap[s.id] = cData;
            for (const c of cData) {
              try {
                const lData = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
                lessonMap[c.id] = lData;
              } catch { lessonMap[c.id] = []; }
            }
          } catch { courseMap[s.id] = []; }
        }
        setCourses(courseMap);
        setLessons(lessonMap);
      } catch {
        setError("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <Skeleton delay={0} className="h-8 w-56" />
          <Skeleton delay={60} className="h-5 w-80 mt-2" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} delay={100 + i * 80} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <Brain className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">{error}</p>
      </div>
    );
  }

  const subjectsWithContent = subjects.filter(
    (s) => (courses[s.id]?.length || 0) > 0
  );

  if (subjectsWithContent.length === 0) {
    return (
      <div className="text-center py-20">
        <Brain className="size-16 text-gray-200 mx-auto mb-5" />
        <p className="text-lg font-semibold text-gray-500">Chưa có môn học nào</p>
        <p className="text-sm text-gray-400 mt-1">Hãy bắt đầu học để xem sơ đồ tư duy</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sơ đồ tư duy</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chọn bài học để AI tạo sơ đồ tư duy trực quan
        </p>
      </div>

      {subjectsWithContent.map((subject) => {
        const subjectCourses = courses[subject.id] || [];
        const hasLessons = subjectCourses.some(
          (c) => (lessons[c.id]?.length || 0) > 0
        );
        if (!hasLessons) return null;

        return (
          <div key={subject.id}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="size-4 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-800">
                {subject.name}
              </h2>
              <Link
                href={`/knowledge-graph/${subject.id}`}
                className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Sơ đồ tri thức toàn môn
                <ArrowUpRight className="size-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {subjectCourses.map((course) => {
                const courseLessons = lessons[course.id] || [];
                return courseLessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/mindmap/${lesson.id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <Brain className="size-4 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">
                          {lesson.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {course.title}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </Link>
                ));
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
