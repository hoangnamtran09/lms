"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount: number;
  createdAt: string;
}

const statusBadge: Record<string, "default" | "secondary"> = {
  SUBMITTED: "default",
  GRADED: "secondary",
  RETURNED: "secondary",
};

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    api<AssignmentRow[]>("/api/assignments")
      .then((data) => {
        // fetch submission count per assignment
        setAssignments(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá bài tập này? Tất cả bài nộp liên quan sẽ bị mất.")) return;
    try {
      await api(`/api/assignments/${id}`, { method: "DELETE" });
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
          <h1 className="text-2xl font-bold text-gray-900">Quản lí Bài tập</h1>
          <p className="text-sm text-gray-500 mt-1">{assignments.length} bài tập</p>
        </div>
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead>Điểm tối đa</TableHead>
                <TableHead>Hạn nộp</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                    Không có bài tập nào
                  </TableCell>
                </TableRow>
              ) : (
                assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-gray-900">{a.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{a.classId || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">{a.maxScore}</TableCell>
                    <TableCell className="text-gray-500">
                      {a.dueDate ? new Date(a.dueDate).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/assignments/${a.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="size-3" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700">
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
    </div>
  );
}
