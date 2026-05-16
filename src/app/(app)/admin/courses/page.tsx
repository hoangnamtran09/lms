"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, ChevronRight, BookOpen, FileText, UploadCloud, Loader2, Pencil } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
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

interface Subject {
  id: string; name: string; gradeLevel: number; sortOrder: number;
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

  const fetchGradeLevels = () => {
    api<GradeLevel[]>("/api/grade-levels").then(setGradeLevels).catch(() => {});
  };

  const fetchSubjects = () => {
    setSubLoading(true);
    api<Subject[]>("/api/subjects").then(setSubjects).catch(() => {}).finally(() => setSubLoading(false));
  };

  const fetchLessonsForSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    setTab("lessons");
    setLessonLoading(true);
    try {
      const courses = await api<Course[]>(`/api/courses?subjectId=${subject.id}`);
      const allLessons: Lesson[] = [];
      for (const c of courses) {
        const l = await api<Lesson[]>(`/api/lessons?courseId=${c.id}`);
        allLessons.push(...l);
      }
      allLessons.sort((a, b) => a.sortOrder - b.sortOrder);
      setLessons(allLessons);
    } catch { /* empty */ }
    setLessonLoading(false);
  };

  useEffect(() => { fetchSubjects(); fetchGradeLevels(); }, []);

  const handleEditSubject = (s: Subject) => {
    setEditing({ type: "subject", entity: s });
    setForm({ name: s.name, gradeLevel: String(s.gradeLevel), sortOrder: String(s.sortOrder) });
    setTab("subjects");
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
            }),
          });
          fetchSubjects();
        } else {
          // Upload new PDF if selected
          let mediaUrl: string | undefined;
          const file = fileRef.current?.files?.[0];
          if (file) {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
            const uploadRes = await fetch(`${API_BASE}/api/media/upload`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            if (!uploadRes.ok) throw new ApiError("Tải file thất bại", uploadRes.status);
            const uploadJson = await uploadRes.json();
            mediaUrl = uploadJson.url;
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
            const formData = new FormData();
            formData.append("file", file);
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
            const uploadRes = await fetch(`${API_BASE}/api/media/upload`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            if (!uploadRes.ok) throw new ApiError("Tải file thất bại", uploadRes.status);
            const uploadJson = await uploadRes.json();
            mediaUrl = uploadJson.url;
            setUploading(false);
          }

          // Find or create a default course for this subject
          const courses = await api<Course[]>(`/api/courses?subjectId=${selectedSubject.id}`);
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
      const uploadRes = await fetch(`${API_BASE}/api/media/upload-bulk`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!uploadRes.ok) throw new ApiError("Upload thất bại", uploadRes.status);
      const { results } = await uploadRes.json() as {
        results: { filename: string; title: string; url: string; key: string; error?: string }[];
      };

      // Step 2: Create lessons for successful uploads
      // Find or create course for this subject
      const courses = await api<Course[]>(`/api/courses?subjectId=${selectedSubject.id}`);
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

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lí Môn học & Bài học</h1>
        <div className="flex gap-2">
          {tab === "lessons" && (
            <Button variant="outline" disabled={!selectedSubject} onClick={() => setBulkOpen(true)}>
              <UploadCloud className="size-4" /> Tải lên PDF bài học hàng loạt
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setForm({}); setError(""); } }}>
            <DialogTrigger
              render={
                <Button
                  disabled={tab === "lessons" && !selectedSubject}
                  onClick={() => { setEditing(null); setForm({}); setError(""); }}
                >
                  <Plus className="size-4" />{dialogTitle}
                </Button>
              }
            />
            <DialogContent>
            <DialogHeader><DialogTitle>{dialogTitle}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Tên</Label>
                <Input
                  value={form.name || form.title || ""}
                  onChange={(e) => setForm({ ...form, [tab === "subjects" ? "name" : "title"]: e.target.value })}
                />
              </div>
              {tab === "subjects" && (
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
        </Dialog>

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
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setTab("subjects")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "subjects" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <BookOpen className="size-4" /> Môn học
        </button>
        <button
          onClick={() => setTab("lessons")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "lessons" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <FileText className="size-4" /> Bài học
        </button>
      </div>

      {/* Subjects Tab */}
      {tab === "subjects" && (
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardContent className="p-0">
            {subLoading ? (
              <div className="p-4"><Skeleton className="h-40 w-full" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên môn học</TableHead>
                    <TableHead>Khối</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-400 py-8">Chưa có môn học nào</TableCell>
                    </TableRow>
                  ) : (
                    subjects.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-gray-900">{s.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {gradeLevels.find(gl => gl.level === s.gradeLevel)?.name || `Khối ${s.gradeLevel}`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEditSubject(s)}>
                              <Pencil className="size-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => fetchLessonsForSubject(s)}>
                              <ChevronRight className="size-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteSubject(s.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lessons Tab */}
      {tab === "lessons" && (
        <div>
          {selectedSubject && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-500">Môn:</span>
              <Badge variant="secondary" className="text-sm">{selectedSubject.name}</Badge>
              <button onClick={() => { setSelectedSubject(null); setTab("subjects"); }} className="text-xs text-gray-400 hover:text-gray-600">
                Đổi môn học
              </button>
            </div>
          )}
          {!selectedSubject ? (
            <div className="text-center py-20 bg-white rounded-lg border">
              <FileText className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Chọn một môn học để xem bài học</p>
              <Button variant="outline" className="mt-4" onClick={() => setTab("subjects")}>
                Xem danh sách môn học
              </Button>
            </div>
          ) : lessonLoading ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : (
            <Card className="rounded-xl ring-1 ring-foreground/10">
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
        </div>
      )}
    </div>
  );
}
