"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Clock, AlertCircle, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Student {
  id: string;
  fullName: string;
  username: string;
}

interface AttendanceRecord {
  studentId: string;
  status: string;
  note: string;
}

interface AttendanceEntry {
  id: string;
  studentId: string;
  status: string;
  note: string;
}

const STATUS_OPTIONS = [
  { value: "PRESENT", label: "Có mặt", icon: Check, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "ABSENT", label: "Vắng", icon: X, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "LATE", label: "Đi muộn", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "EXCUSED", label: "Có phép", icon: AlertCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
];

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function TeacherAttendancePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayString);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user?.classId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentList, existingAttendance] = await Promise.all([
          api<Student[]>("/api/teacher/students"),
          api<AttendanceEntry[]>(`/api/attendance?classId=${user?.classId}&date=${date}`),
        ]);
        setStudents(studentList);
        const map: Record<string, string> = {};
        const notes: Record<string, string> = {};
        for (const a of existingAttendance) {
          map[a.studentId] = a.status;
          if (a.note) notes[a.studentId] = a.note;
        }
        setAttendanceMap(map);
        setNotesMap(notes);
      } catch {
        setError("Không thể tải dữ liệu");
      } finally {
        setLoading(false);
      }
    })();
  }, [date, user?.classId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (user && user.role !== "TEACHER" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    router.replace("/");
    return null;
  }

  const presentCount = students.filter((s) => attendanceMap[s.id] === "PRESENT").length;
  const totalCount = students.length;

  const handleSave = async () => {
    if (!user?.classId) return;
    setSaving(true);
    setError(null);
    try {
      const records: AttendanceRecord[] = students.map((s) => ({
        studentId: s.id,
        status: attendanceMap[s.id] || "PRESENT",
        note: notesMap[s.id] || "",
      }));
      await api("/api/attendance", {
        method: "POST",
        body: JSON.stringify({ classId: user.classId, date, records }),
      });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  if (!user?.classId) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Bạn chưa được phân công lớp nào</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điểm danh</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? `${presentCount}/${totalCount} có mặt` : "Chưa có học sinh"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            <Save className="size-4" />
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} delay={i * 80} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500">Lớp chưa có học sinh nào</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const currentStatus = attendanceMap[s.id] || "PRESENT";
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-foreground/10"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-gray-400">{s.username}</p>
                </div>
                <div className="flex gap-1">
                  {STATUS_OPTIONS.map((opt) => {
                    const isActive = currentStatus === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setAttendanceMap((prev) => ({
                            ...prev,
                            [s.id]: isActive ? prev[s.id] || "PRESENT" : opt.value,
                          }))
                        }
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? opt.color + " ring-2 ring-offset-1"
                            : "text-gray-400 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <opt.icon className="size-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {currentStatus !== "PRESENT" && (
                  <input
                    value={notesMap[s.id] || ""}
                    onChange={(e) =>
                      setNotesMap((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="Ghi chú..."
                    className="w-28 rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
