"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, ChevronRight, BookOpen, FileText,
  UploadCloud, Loader2, Pencil, FlaskConical, Calculator, Music,
  Palette, Globe, Monitor, Heart, Dumbbell, Atom, type LucideIcon,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, ApiError, uploadFile, fetchList } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subject {
  id: string; name: string; gradeLevel: number; sortOrder: number;
  icon?: string; color?: string; description?: string;
}
interface Lesson {
  id: string; courseId: string; title: string; durationMinutes: number;
  sortOrder: number; isPublished: boolean; mediaUrl?: string;
}
interface Course {
  id: string; subjectId: string; title: string;
}
interface GradeLevel {
  id: string; name: string; level: number;
}

type Tab = "subjects" | "lessons";

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const iconMap: Record<string, LucideIcon> = {
  BookOpen, FlaskConical, Calculator, Music, Palette,
  Globe, Monitor, Heart, Dumbbell, Atom,
};

function getSubjectIcon(iconName?: string): LucideIcon {
  if (iconName && iconMap[iconName]) return iconMap[iconName];
  return BookOpen;
}

const subjectColors: { bg: string; text: string; badge: string }[] = [
  { bg: "bg-blue-50", text: "text-blue-600", badge: "bg-blue-50 text-blue-700" },
  { bg: "bg-pink-50", text: "text-pink-600", badge: "bg-pink-50 text-pink-700" },
  { bg: "bg-emerald-50", text: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700" },
  { bg: "bg-amber-50", text: "text-amber-600", badge: "bg-amber-50 text-amber-700" },
  { bg: "bg-purple-50", text: "text-purple-600", badge: "bg-purple-50 text-purple-700" },
  { bg: "bg-cyan-50", text: "text-cyan-600", badge: "bg-cyan-50 text-cyan-700" },
  { bg: "bg-rose-50", text: "text-rose-600", badge: "bg-rose-50 text-rose-700" },
  { bg: "bg-indigo-50", text: "text-indigo-600", badge: "bg-indigo-50 text-indigo-700" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Shared dialog content — defined at module level to avoid "component during render"
function SubjectLessonDialog({
  dialogTitle, tab, editing, form, setForm, gradeLevels, error, fileRef, uploading,
  handleSave, saving,
}: {
  dialogTitle: string; tab: Tab; editing: { type: "subject"; entity: Subject } | { type: "lesson"; entity: Lesson } | null;
  form: Record<string, string>; setForm: (f: Record<string, string>) => void;
  gradeLevels: GradeLevel[]; error: string; fileRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean; handleSave: () => void; saving: boolean;
}) {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
      <div className="space-y-4 mt-4">
        <div>
          <Label>Tên</Label>
          <Input
            value={form.name || form.title || ""}
            onChange={(e) => setForm({ ...form, [tab === "subjects" || editing?.type === "subject" ? "name" : "title"]: e.target.value })}
          />
        </div>
        {(tab === "subjects" || editing?.type === "subject") && (
          <>
            <div>
              <Label>Mô tả</Label>
              <Input
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả ngắn về môn học..."
              />
            </div>
            <div>
              <Label>Khối lớp</Label>
              <Select value={form.gradeLevel || ""} onValueChange={(value) => setForm({ ...form, gradeLevel: value as string })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn khối lớp" />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((gl) => (
                    <SelectItem key={gl.id} value={String(gl.level)}>
                      {gl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {(tab === "lessons" || editing?.type === "lesson") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Thời lượng (phút)</Label>
              <Input type="number" value={form.durationMinutes || ""} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div>
              <Label>Thứ tự</Label>
              <Input type="number" value={form.sortOrder || ""} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
            </div>
          </div>
        )}
        {editing?.type === "lesson" && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublished"
              checked={form.isPublished === "true"}
              onChange={(e) => setForm({ ...form, isPublished: String(e.target.checked) })}
              className="size-4 rounded border-gray-300"
            />
            <Label htmlFor="isPublished" className="cursor-pointer">Công khai</Label>
          </div>
        )}
        {(tab === "lessons" || editing?.type === "lesson") && (
          <div>
            <Label>File PDF {editing && <span className="text-xs text-gray-400">(để trống nếu không đổi)</span>}</Label>
            {editing?.type === "lesson" && editing.entity.mediaUrl && (
              <p className="text-xs text-gray-400 mb-1">File hiện tại: {editing.entity.mediaUrl.split("/").pop()}</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            {uploading && <p className="text-xs text-blue-500 mt-1">Đang tải file lên...</p>}
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button onClick={handleSave} disabled={saving || uploading} className="w-full">
          {uploading ? "Đang tải lên..." : saving ? (editing ? "Đang lưu..." : "Đang tạo...") : (editing ? "Lưu thay đổi" : "Tạo")}
        </Button>
      </div>
    </DialogContent>
  );
}

export default function AdminCoursesPage() {
  const [tab, setTab] = useState<Tab>("subjects");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subLoading, setSubLoading] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ type: "subject"; entity: Subject } | { type: "lesson"; entity: Lesson } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Bulk upload
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [bulkError, setBulkError] = useState("");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);

  const fetchSubjects = () => {
    setSubLoading(true);
    api<Subject[]>("/api/subjects").then(setSubjects).catch(() => {}).finally(() => setSubLoading(false));
  };

  const fetchLessonsForSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    setTab("lessons");
    setLessonLoading(true);
    try {
      const allLessons: Lesson[] = [];
      for (const c of await fetchList<Course>(`/api/courses?subjectId=${subject.id}`)) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        allLessons.push(...l);
      }
      allLessons.sort((a, b) => {
        const na = parseInt((a.title.match(/\d+/) || [""])[0]) || 0;
        const nb = parseInt((b.title.match(/\d+/) || [""])[0]) || 0;
        return na - nb;
      });
      setLessons(allLessons);
    } catch { /* empty */ }
    setLessonLoading(false);
  };

  useEffect(() => {
    Promise.all([
      api<Subject[]>("/api/subjects"),
      api<GradeLevel[]>("/api/grade-levels"),
    ])
      .then(([subjects, gl]) => {
        setSubjects(subjects);
        setGradeLevels(gl);
      })
      .catch(() => {})
      .finally(() => setSubLoading(false));
  }, []);

  const handleEditSubject = (s: Subject) => {
    setEditing({ type: "subject", entity: s });
    setForm({
      name: s.name,
      gradeLevel: String(s.gradeLevel),
      sortOrder: String(s.sortOrder),
      description: s.description || "",
    });
    setError("");
    setDialogOpen(true);
  };

  const handleEditLesson = (l: Lesson) => {
    setEditing({ type: "lesson", entity: l });
    setForm({ title: l.title, durationMinutes: String(l.durationMinutes), sortOrder: String(l.sortOrder), isPublished: String(l.isPublished) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        // Edit mode — PATCH
        if (editing.type === "subject") {
          await api(`/api/subjects/${editing.entity.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              name: form.name,
              gradeLevel: parseInt(form.gradeLevel || "0"),
              sortOrder: parseInt(form.sortOrder || "0"),
              description: form.description || "",
            }),
          });
          fetchSubjects();
        } else {
          // Upload new PDF if selected
          let mediaUrl: string | undefined;
          const file = fileRef.current?.files?.[0];
          if (file) {
            setUploading(true);
            const extra = selectedSubject ? { folder: `FILEPDF/${selectedSubject.name}`, fileName: `${form.title}.pdf` } : undefined;
            const { url } = await uploadFile("/api/media/upload", file, extra);
            mediaUrl = url;
            setUploading(false);
          }
          const body: Record<string, unknown> = {
            title: form.title,
            durationMinutes: parseInt(form.durationMinutes || "0"),
            sortOrder: parseInt(form.sortOrder || "0"),
            isPublished: form.isPublished === "true",
          };
          if (mediaUrl) body.mediaUrl = mediaUrl;
          await api(`/api/lessons/${editing.entity.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
          if (selectedSubject) fetchLessonsForSubject(selectedSubject);
        }
      } else {
        // Create mode — POST
        if (tab === "subjects") {
          await api("/api/subjects", {
            method: "POST",
            body: JSON.stringify({
              id: crypto.randomUUID(), name: form.name,
              gradeLevel: parseInt(form.gradeLevel || "0"),
              sortOrder: parseInt(form.sortOrder || "0"),
              description: form.description || "",
              icon: "BookOpen", color: "#4F46E5",
            }),
          });
          fetchSubjects();
        } else {
          if (!selectedSubject) return;

          // Upload PDF if selected
          let mediaUrl = "";
          const file = fileRef.current?.files?.[0];
          if (file) {
            setUploading(true);
            const extra = selectedSubject ? { folder: `FILEPDF/${selectedSubject.name}`, fileName: `${form.title}.pdf` } : undefined;
            const { url } = await uploadFile("/api/media/upload", file, extra);
            mediaUrl = url;
            setUploading(false);
          }

          // Find or create a default course for this subject
          const courses = await fetchList<Course>(`/api/courses?subjectId=${selectedSubject.id}`);
          let courseId = courses[0]?.id;
          if (!courseId) {
            const c = await api<Course>(`/api/courses`, {
              method: "POST",
              body: JSON.stringify({
                id: crypto.randomUUID(), subjectId: selectedSubject.id,
                title: selectedSubject.name,
                gradeLevel: selectedSubject.gradeLevel,
                sortOrder: 0,
              }),
            });
            courseId = c.id;
          }
          await api("/api/lessons", {
            method: "POST",
            body: JSON.stringify({
              id: crypto.randomUUID(), courseId,
              title: form.title,
              durationMinutes: parseInt(form.durationMinutes || "0"),
              sortOrder: parseInt(form.sortOrder || "0"),
              mediaUrl: mediaUrl || undefined,
            }),
          });
          fetchLessonsForSubject(selectedSubject);
        }
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editing ? "Cập nhật thất bại" : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Xoá môn học này? Tất cả bài học bên trong cũng sẽ bị xoá.")) return;
    try {
      await api(`/api/subjects/${id}`, { method: "DELETE" });
      fetchSubjects();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Xoá bài học này?")) return;
    try {
      await api(`/api/lessons/${id}`, { method: "DELETE" });
      if (selectedSubject) fetchLessonsForSubject(selectedSubject);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFiles || bulkFiles.length === 0 || !selectedSubject) return;
    setBulkUploading(true);
    setBulkError("");
    setBulkProgress({ done: 0, total: bulkFiles.length });

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

    try {
      // Step 1: Upload all files to R2
      const formData = new FormData();
      for (let i = 0; i < bulkFiles.length; i++) {
        formData.append("files", bulkFiles[i]);
      }
      formData.append("folder", `FILEPDF/${selectedSubject.name}`);
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const uploadRes = await fetch(`${API_BASE}/api/media/upload-bulk`, {
        method: "POST",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!uploadRes.ok) throw new ApiError("Upload thất bại", uploadRes.status);
      const { results } = await uploadRes.json() as {
        results: { filename: string; title: string; url: string; key: string; error?: string }[];
      };

      // Step 2: Create lessons for successful uploads
      const courses = await fetchList<Course>(`/api/courses?subjectId=${selectedSubject.id}`);
      let courseId = courses[0]?.id;
      if (!courseId) {
        const c = await api<Course>(`/api/courses`, {
          method: "POST",
          body: JSON.stringify({
            id: crypto.randomUUID(), subjectId: selectedSubject.id,
            title: selectedSubject.name,
            gradeLevel: selectedSubject.gradeLevel,
            sortOrder: 0,
          }),
        });
        courseId = c.id;
      }

      let done = 0;
      for (const r of results) {
        if (r.error) {
          done++;
          continue;
        }
        try {
          await api("/api/lessons", {
            method: "POST",
            body: JSON.stringify({
              id: crypto.randomUUID(), courseId,
              title: r.title,
              durationMinutes: 0,
              sortOrder: 0,
              mediaUrl: r.url,
            }),
          });
        } catch { /* skip failed lesson creation */ }
        done++;
        setBulkProgress({ done, total: results.length });
      }

      fetchLessonsForSubject(selectedSubject);
      setBulkOpen(false);
      setBulkFiles(null);
    } catch (err) {
      setBulkError(err instanceof ApiError ? err.message : "Tải lên thất bại");
    } finally {
      setBulkUploading(false);
    }
  };

  const dialogTitle = editing
    ? (editing.type === "subject" ? "Sửa môn học" : "Sửa bài học")
    : (tab === "subjects" ? "Thêm môn học" : "Thêm bài học");

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  const onDialogOpen = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditing(null); setForm({}); setError(""); }
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại Dashboard
      </Link>

      {/* ---- Subjects Tab ---- */}
      {tab === "subjects" && (
        <>
          {/* Hero Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <nav className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Quản trị</span>
                <ChevronRight className="size-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Môn học</span>
              </nav>
              <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-1">
                Quản lí Môn học
              </h2>
              <p className="text-base text-gray-500">
                Quản lý danh sách môn học, bài giảng và nội dung giảng dạy trong hệ thống.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={onDialogOpen}>
                <DialogTrigger
                  render={
                    <Button
                      className="gap-2 rounded-xl shadow-sm"
                      onClick={() => { setEditing(null); setForm({}); setError(""); setTab("subjects"); }}
                    >
                      <Plus className="size-4" />
                      Thêm môn học mới
                    </Button>
                  }
                />
                <SubjectLessonDialog
                  dialogTitle={dialogTitle}
                  tab={tab}
                  editing={editing}
                  form={form}
                  setForm={setForm}
                  gradeLevels={gradeLevels}
                  error={error}
                  fileRef={fileRef}
                  uploading={uploading}
                  handleSave={handleSave}
                  saving={saving}
                />
              </Dialog>
            </div>
          </div>

          {/* Bento Grid */}
          {subLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((s, idx) => {
                const IconComp = getSubjectIcon(s.icon);
                const palette = subjectColors[idx % subjectColors.length];
                const gradeLabel = gradeLevels.find(gl => gl.level === s.gradeLevel)?.name || `Khối ${s.gradeLevel}`;
                return (
                  <Card
                    key={s.id}
                    className="group rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-300 overflow-hidden"
                  >
                    <CardContent className="p-6">
                      {/* Icon + Badge row */}
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 ${palette.bg} rounded-xl flex items-center justify-center ${palette.text}`}>
                          <IconComp className="size-6" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                          {gradeLabel}
                        </Badge>
                      </div>

                      {/* Name + Description */}
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{s.name}</h3>
                      <p className="text-sm text-gray-500 mb-6 line-clamp-2 min-h-[2.5rem]">
                        {s.description || "Chưa có mô tả"}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchLessonsForSubject(s)}
                          className="flex-1 rounded-lg gap-1.5"
                        >
                          <FileText className="size-3.5" />
                          Bài học
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSubject(s)}
                          className="rounded-lg"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSubject(s.id)}
                          className="rounded-lg text-red-500 hover:text-red-700 hover:border-red-200"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Subject Placeholder */}
              <div
                className="group border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center hover:bg-blue-50/50 hover:border-primary/40 transition-all cursor-pointer min-h-[280px]"
                onClick={() => { setEditing(null); setForm({}); setError(""); setTab("subjects"); setDialogOpen(true); }}
              >
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:bg-blue-100 transition-colors mb-4">
                  <Plus className="size-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-400 group-hover:text-primary">
                  Thêm môn học mới
                </h3>
                <p className="text-sm text-gray-400 mt-2 max-w-[200px]">
                  Bắt đầu xây dựng nội dung giảng dạy cho môn học mới.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Lessons Tab ---- */}
      {tab === "lessons" && (
        <div>
          {/* Lessons Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <nav className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Quản trị</span>
                <ChevronRight className="size-3" />
                <button
                  onClick={() => { setSelectedSubject(null); setTab("subjects"); }}
                  className="text-[10px] font-bold uppercase tracking-wider hover:text-primary transition-colors"
                >
                  Môn học
                </button>
                <ChevronRight className="size-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Bài học</span>
              </nav>
              <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900 mb-1">
                {selectedSubject?.name || "Bài học"}
              </h2>
              <p className="text-base text-gray-500">
                Quản lý danh sách bài học, tài liệu PDF và nội dung giảng dạy.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={!selectedSubject} onClick={() => setBulkOpen(true)} className="gap-2 rounded-xl">
                <UploadCloud className="size-4" /> Tải lên hàng loạt
              </Button>
              <Dialog open={dialogOpen} onOpenChange={onDialogOpen}>
                <DialogTrigger
                  render={
                    <Button
                      disabled={!selectedSubject}
                      className="gap-2 rounded-xl shadow-sm"
                      onClick={() => { setEditing(null); setForm({}); setError(""); }}
                    >
                      <Plus className="size-4" /> Thêm bài học
                    </Button>
                  }
                />
                <SubjectLessonDialog
                  dialogTitle={dialogTitle}
                  tab={tab}
                  editing={editing}
                  form={form}
                  setForm={setForm}
                  gradeLevels={gradeLevels}
                  error={error}
                  fileRef={fileRef}
                  uploading={uploading}
                  handleSave={handleSave}
                  saving={saving}
                />
              </Dialog>
            </div>
          </div>

          {/* Back to subjects */}
          {selectedSubject && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Môn:</span>
              <Badge variant="secondary" className="text-sm">{selectedSubject.name}</Badge>
              <button
                onClick={() => { setSelectedSubject(null); setTab("subjects"); }}
                className="text-xs text-gray-400 hover:text-gray-600 ml-2"
              >
                ← Quay lại danh sách môn học
              </button>
            </div>
          )}

          {!selectedSubject ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
              <FileText className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Chọn một môn học để xem bài học</p>
              <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setTab("subjects")}>
                Xem danh sách môn học
              </Button>
            </div>
          ) : lessonLoading ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : (
            <Card className="rounded-2xl border border-gray-100 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên bài học</TableHead>
                      <TableHead>PDF</TableHead>
                      <TableHead>Thời lượng</TableHead>
                      <TableHead>Công khai</TableHead>
                      <TableHead>Thứ tự</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lessons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">Chưa có bài học nào</TableCell>
                      </TableRow>
                    ) : (
                      lessons.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium text-gray-900">{l.title}</TableCell>
                          <TableCell>
                            {l.mediaUrl ? (
                              <Badge variant="default" className="text-xs">Có</Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-500">{l.durationMinutes} phút</TableCell>
                          <TableCell>
                            <Badge variant={l.isPublished ? "default" : "outline"} className="text-xs">
                              {l.isPublished ? "Có" : "Ẩn"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-500">{l.sortOrder}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="outline" size="sm" onClick={() => handleEditLesson(l)}>
                                <Pencil className="size-3" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleDeleteLesson(l.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Bulk upload dialog */}
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Tải lên hàng loạt</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-gray-500">
                  Chọn nhiều file PDF. Tên bài học sẽ được lấy từ tên file (bỏ đuôi .pdf).
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => setBulkFiles(e.target.files)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {bulkFiles && bulkFiles.length > 0 && (
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                    {Array.from(bulkFiles).map((f, i) => (
                      <p key={i} className="truncate">{f.name.replace(/\.pdf$/i, "")}</p>
                    ))}
                  </div>
                )}
                {bulkUploading && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải lên... {bulkProgress.done}/{bulkProgress.total}
                  </div>
                )}
                {bulkError && <p className="text-sm text-red-500">{bulkError}</p>}
                <Button
                  onClick={handleBulkUpload}
                  disabled={!bulkFiles || bulkFiles.length === 0 || bulkUploading}
                  className="w-full"
                >
                  {bulkUploading ? "Đang xử lý..." : `Tải lên ${bulkFiles ? bulkFiles.length : 0} file`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
