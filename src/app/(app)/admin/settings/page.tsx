"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
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

interface GradeLevel {
  id: string;
  name: string;
  level: number;
}

export default function AdminSettingsPage() {
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<GradeLevel | null>(null);
  const [form, setForm] = useState({ name: "", level: "" });

  const fetchGradeLevels = () => {
    setLoading(true);
    api<GradeLevel[]>("/api/grade-levels")
      .then(setGradeLevels)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGradeLevels(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", level: "" });
    setError("");
    setDialogOpen(true);
  };

  const openEdit = (gl: GradeLevel) => {
    setEditing(gl);
    setForm({ name: gl.name, level: String(gl.level) });
    setError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api(`/api/grade-levels/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, level: parseInt(form.level) }),
        });
      } else {
        await api("/api/grade-levels", {
          method: "POST",
          body: JSON.stringify({ name: form.name, level: parseInt(form.level) }),
        });
      }
      setDialogOpen(false);
      setEditing(null);
      fetchGradeLevels();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : editing ? "Cập nhật thất bại" : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá khối lớp này?")) return;
    try {
      await api(`/api/grade-levels/${id}`, { method: "DELETE" });
      fetchGradeLevels();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" /> Quay lại
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setError(""); } }}>
          <DialogTrigger
            render={<Button onClick={openAdd}><Plus className="size-4" />Thêm khối lớp</Button>}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Sửa khối lớp" : "Thêm khối lớp"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Tên khối</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Khối 1"
                />
              </div>
              <div>
                <Label>Cấp độ</Label>
                <Input
                  type="number"
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  placeholder="Ví dụ: 1"
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4"><Skeleton className="h-40 w-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên khối</TableHead>
                  <TableHead>Cấp độ</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeLevels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                      Chưa có khối lớp nào
                    </TableCell>
                  </TableRow>
                ) : (
                  gradeLevels.map((gl) => (
                    <TableRow key={gl.id}>
                      <TableCell className="font-medium text-gray-900">{gl.name}</TableCell>
                      <TableCell className="text-gray-500">{gl.level}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => openEdit(gl)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(gl.id)}
                            className="text-red-500 hover:text-red-700"
                          >
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
    </div>
  );
}
