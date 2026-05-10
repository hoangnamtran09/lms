"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { api, uploadFile } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
}

const backLink = "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-6";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rubric, setRubric] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [classId, setClassId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentBrief[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  useEffect(() => {
    api<StudentBrief[]>("/api/users?role=STUDENT")
      .then((data) => setStudents(data))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề bài tập");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let attachmentUrl = "";
      if (selectedFile) {
        const uploadResult = await uploadFile("/api/assignments/upload", selectedFile);
        attachmentUrl = uploadResult.url;
      }
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        rubric: rubric.trim(),
        maxScore,
        classId: classId.trim(),
        attachmentUrl,
        studentIds: selectedStudentIds.length > 0 ? JSON.stringify(selectedStudentIds) : "",
      };
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      });
      router.push("/assignments");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Link href="/assignments" className={backLink}>
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tạo bài tập mới</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div>
          <Label htmlFor="title">Tiêu đề</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhập tiêu đề bài tập"
          />
        </div>

        <div>
          <Label htmlFor="desc">Mô tả / Câu hỏi</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nhập nội dung câu hỏi hoặc yêu cầu bài tập"
            rows={5}
          />
        </div>

        <div>
          <Label htmlFor="rubric">Tiêu chí chấm điểm</Label>
          <Textarea
            id="rubric"
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            placeholder="Nhập tiêu chí chấm điểm (VD: Trả lời đúng ý chính: 50%, Lập luận rõ ràng: 30%, Trình bày: 20%)"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="score">Điểm tối đa</Label>
            <Input
              id="score"
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
              min={1}
              max={10}
            />
          </div>

          <div>
            <Label htmlFor="class">Lớp (tuỳ chọn)</Label>
            <Input
              id="class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              placeholder="ID của lớp học"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="due">Hạn nộp (tuỳ chọn)</Label>
          <Input
            id="due"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="file">Tệp PDF đính kèm (tuỳ chọn)</Label>
          {selectedFile ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600 truncate flex-1">{selectedFile.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="text-red-500 hover:text-red-700 shrink-0"
              >
                Gỡ
              </Button>
            </div>
          ) : (
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          )}
        </div>

        <div>
          <Label>Học sinh nhận bài (để trống = cả lớp)</Label>
          {students.length === 0 ? (
            <p className="text-sm text-gray-400 mt-1">Đang tải danh sách học sinh...</p>
          ) : (
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-0.5 mt-1">
              {students.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.supabaseId)}
                    onChange={() => {
                      setSelectedStudentIds((prev) =>
                        prev.includes(s.supabaseId) ? prev.filter((id) => id !== s.supabaseId) : [...prev, s.supabaseId]
                      );
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{s.fullName}</span>
                  <span className="text-xs text-gray-400 ml-auto">{s.username}</span>
                </label>
              ))}
            </div>
          )}
          {selectedStudentIds.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">Đã chọn {selectedStudentIds.length} học sinh</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleCreate} disabled={submitting}>
            <Plus className="size-4 mr-2" />
            {submitting ? "Đang tạo..." : "Tạo bài tập"}
          </Button>
          <Link href="/assignments" className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Huỷ
          </Link>
        </div>
      </div>
    </div>
  );
}
