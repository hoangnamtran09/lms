"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, ArrowRight, Sparkles, Clock, CheckCircle2, Sigma, BookOpen, Languages, Zap, FlaskConical, Dna, ScrollText, Globe } from "lucide-react";

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

import type { FC } from "react";
import type { LucideProps } from "lucide-react";

type SubjectMeta = { icon: FC<LucideProps>; color: string };
const subjectMetaMap: Record<string, SubjectMeta> = {
  toán: { icon: Sigma, color: "bg-blue-50 text-blue-600" },
  văn: { icon: BookOpen, color: "bg-pink-50 text-pink-600" },
  việt: { icon: BookOpen, color: "bg-pink-50 text-pink-600" },
  anh: { icon: Languages, color: "bg-emerald-50 text-emerald-600" },
  lý: { icon: Zap, color: "bg-purple-50 text-purple-600" },
  hóa: { icon: FlaskConical, color: "bg-indigo-50 text-indigo-600" },
  sinh: { icon: Dna, color: "bg-teal-50 text-teal-600" },
  sử: { icon: ScrollText, color: "bg-orange-50 text-orange-600" },
  địa: { icon: Globe, color: "bg-cyan-50 text-cyan-600" },
};
const defaultMeta: SubjectMeta = { icon: Brain, color: "bg-amber-50 text-amber-600" };

function getSubjectMeta(name: string): SubjectMeta {
  const lower = name.toLowerCase();
  for (const [key, meta] of Object.entries(subjectMetaMap)) {
    if (lower.includes(key)) return meta;
  }
  return defaultMeta;
}

export default function MindMapPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState("");

  // Fetch subjects on mount
  useEffect(() => {
    let cancelled = false;
    api<Subject[]>("/api/subjects")
      .then((data) => { if (!cancelled) setSubjects(data); })
      .catch(() => { if (!cancelled) setSubjects([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch courses when subject changes
  useEffect(() => {
    if (!selectedSubject) return;
    let cancelled = false;
    setCourses([]);
    setLessons([]);
    setSelectedLessonId("");
    api<{ data: Course[] }>(`/api/courses?subjectId=${selectedSubject.id}&limit=100`)
      .then((res) => {
        if (cancelled) return;
        const cData = res?.data || [];
        setCourses(cData);
        // Fetch lessons for all courses
        Promise.all(
          cData.map((c) =>
            api<Lesson[]>(`/api/lessons?courseId=${c.id}`)
              .then((lData) => lData || [])
              .catch(() => [] as Lesson[])
          )
        ).then((allLessons) => {
          if (cancelled) return;
          const flat = allLessons.flat();
          const extractNum = (title: string): number => {
            const m = title.match(/(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
          };
          flat.sort((a, b) => {
            const numA = extractNum(a.title);
            const numB = extractNum(b.title);
            if (numA !== numB) return numA - numB;
            return a.title.localeCompare(b.title, "vi");
          });
          setLessons(flat);
        });
      })
      .catch(() => { if (!cancelled) setCourses([]); });
    return () => { cancelled = true; };
  }, [selectedSubject]);

  const canProceed = selectedSubject && selectedLessonId;

  const handleCreate = () => {
    if (canProceed) {
      router.push(`/mindmap/${selectedLessonId}`);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-8">
        <Skeleton delay={0} className="h-10 w-72 mb-2" />
        <Skeleton delay={60} className="h-5 w-96 mb-10" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} delay={80 + i * 40} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-10">
        <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-2">
          Tạo sơ đồ tư duy
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-1 bg-primary text-white rounded-full text-xs font-bold">
            Bước 1
          </div>
          <p className="text-base text-gray-500">Chọn nguồn dữ liệu bài học</p>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Selection */}
        <div className="col-span-12 lg:col-span-8 space-y-10">
          {/* Section 1: Choose Subject */}
          <section>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">1. Chọn Môn học</h3>
                <p className="text-sm text-gray-500">Vui lòng chọn lĩnh vực kiến thức bạn muốn tóm tắt</p>
              </div>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                <Brain className="size-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có môn học nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {subjects.map((s) => {
                  const meta = getSubjectMeta(s.name);
                  const IconComponent = meta.icon;
                  const isActive = selectedSubject?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSubject(s)}
                      className={`group cursor-pointer p-6 rounded-2xl shadow-sm transition-all flex flex-col items-center text-center gap-4 active:scale-95 ${
                        isActive
                          ? "bg-primary/5 border-2 border-primary"
                          : "bg-white border border-gray-200 hover:shadow-md"
                      }`}
                    >
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                          isActive ? "bg-primary text-white" : meta.color
                        }`}
                      >
                        <IconComponent className="size-7" />
                      </div>
                      <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-gray-700 group-hover:text-primary"}`}>
                        {s.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 2: Choose Lesson */}
          <section className={`transition-opacity duration-300 ${!selectedSubject ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900">2. Chọn Bài học</h3>
              <p className="text-sm text-gray-500">Chọn chương hoặc bài học cụ thể từ môn học đã chọn</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              {lessons.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {courses.length === 0
                    ? "Môn học này chưa có bài học nào"
                    : "Đang tải danh sách bài học..."}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {lessons.map((lesson) => {
                    const course = courses.find((c) => c.id === lesson.courseId);
                    const isSelected = selectedLessonId === lesson.id;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLessonId(lesson.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 text-primary font-semibold"
                            : "border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <span className="text-sm">{lesson.title}</span>
                        {course && (
                          <span className={`text-xs ml-2 ${isSelected ? "text-primary/60" : "text-gray-400"}`}>
                            — {course.title}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right: Summary + CTA */}
        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            {/* Preview Card */}
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-xl shadow-primary/5 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Tóm tắt yêu cầu</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedSubject ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-300"}`}>
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Môn học</p>
                    <p className={`text-sm font-bold ${selectedSubject ? "text-gray-900" : "text-gray-400"}`}>
                      {selectedSubject?.name || "Chưa chọn"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${selectedLessonId ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-300"}`}>
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Bài học</p>
                    <p className={`text-sm font-bold ${selectedLessonId ? "text-gray-900" : "text-gray-400"}`}>
                      {selectedLessonId
                        ? lessons.find((l) => l.id === selectedLessonId)?.title || "Đã chọn"
                        : "Chưa chọn"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
                <div className="flex items-center gap-3 text-gray-500">
                  <Sparkles className="size-5" />
                  <p className="text-xs">Sơ đồ tư duy giúp bạn hệ thống kiến thức trực quan</p>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <Clock className="size-5" />
                  <p className="text-xs">Thời gian tạo: vài giây</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <button
                onClick={handleCreate}
                disabled={!canProceed}
                className={`w-full py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${
                  canProceed
                    ? "bg-primary text-white hover:shadow-lg active:scale-95"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                Tiếp theo
                <ArrowRight className="size-5" />
              </button>
              <p className="text-center text-xs text-gray-500 px-6">
                Bạn có thể quay lại thay đổi nguồn dữ liệu ở các bước sau.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
