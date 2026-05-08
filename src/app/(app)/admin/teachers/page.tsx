"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/components/auth/auth-provider";

interface TeacherRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  classId: string;
  createdAt: string;
}

export default function AdminTeachersPage() {
  const { user: me } = useAuth();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    api<TeacherRow[]>("/api/users?role=TEACHER")
      .then(setTeachers)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá giáo viên này?")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      fetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lí Giáo viên</h1>
          <p className="text-sm text-gray-500 mt-1">{teachers.length} giáo viên</p>
        </div>
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Lớp phụ trách</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Không có giáo viên nào
                  </TableCell>
                </TableRow>
              ) : (
                teachers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-gray-900">{t.fullName}</TableCell>
                    <TableCell className="text-gray-500">{t.username}</TableCell>
                    <TableCell className="text-gray-500">{t.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{t.classId || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        disabled={t.id === me?.id}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
