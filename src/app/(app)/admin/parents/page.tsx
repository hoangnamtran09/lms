"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Heart, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LinkRow {
  id: string;
  parentId: string;
  parentName: string;
  childId: string;
  childName: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  fullName: string;
}

export default function AdminParentsPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ parentId: "", childId: "" });

  // Create parent form
  const [parentOpen, setParentOpen] = useState(false);
  const [parentSaving, setParentSaving] = useState(false);
  const [parentError, setParentError] = useState("");
  const [parentForm, setParentForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
  });

  const fetchParents = () => {
    api<UserRow[]>("/api/users?role=PARENT")
      .then(setParents)
      .catch(() => {});
  };

  const fetchLinks = () => {
    setLoading(true);
    api<LinkRow[]>("/api/admin/parent-links")
      .then(setLinks)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      api<LinkRow[]>("/api/admin/parent-links"),
      api<UserRow[]>("/api/users?role=PARENT"),
      api<UserRow[]>("/api/users?role=STUDENT"),
    ])
      .then(([l, p, s]) => {
        setLinks(l);
        setParents(p);
        setStudents(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setError("");
    setSaving(true);
    try {
      await api("/api/admin/parent-links", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ parentId: "", childId: "" });
      fetchLinks();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateParent = async () => {
    setParentError("");
    setParentSaving(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({ ...parentForm, role: "PARENT" }),
      });
      setParentOpen(false);
      setParentForm({ username: "", password: "", fullName: "", email: "" });
      fetchParents();
    } catch (err) {
      setParentError(err instanceof ApiError ? err.message : "Tạo thất bại");
    } finally {
      setParentSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá liên kết này?")) return;
    try {
      await api(`/api/admin/parent-links/${id}`, { method: "DELETE" });
      fetchLinks();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-10 w-full rounded-lg" />
        <Skeleton delay={200} className="h-60 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-2"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Phụ huynh</h1>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={parentOpen} onOpenChange={setParentOpen}>
            <DialogTrigger render={<Button variant="outline"><UserPlus className="size-4" />Tạo phụ huynh</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo tài khoản Phụ huynh</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="parent-fullname">Họ tên</Label>
                  <Input
                    id="parent-fullname"
                    value={parentForm.fullName}
                    onChange={(e) => setParentForm({ ...parentForm, fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="parent-username">Tên đăng nhập</Label>
                  <Input
                    id="parent-username"
                    value={parentForm.username}
                    onChange={(e) => setParentForm({ ...parentForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="parent-password">Mật khẩu</Label>
                  <Input
                    id="parent-password"
                    type="password"
                    value={parentForm.password}
                    onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="parent-email">Email</Label>
                  <Input
                    id="parent-email"
                    type="email"
                    value={parentForm.email}
                    onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
                  />
                </div>
                {parentError && <p className="text-sm text-red-500">{parentError}</p>}
                <Button
                  onClick={handleCreateParent}
                  disabled={parentSaving || !parentForm.username || !parentForm.password || !parentForm.fullName}
                  className="w-full"
                >
                  {parentSaving ? "Đang tạo..." : "Tạo phụ huynh"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button><Plus className="size-4" />Thêm liên kết</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Liên kết Phụ huynh - Học sinh</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Phụ huynh</label>
                  <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v || "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn phụ huynh" />
                    </SelectTrigger>
                    <SelectContent>
                      {parents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Học sinh</label>
                  <Select value={form.childId} onValueChange={(v) => setForm({ ...form, childId: v || "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn học sinh" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button onClick={handleCreate} disabled={saving || !form.parentId || !form.childId} className="w-full">
                  {saving ? "Đang tạo..." : "Tạo liên kết"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phụ huynh</TableHead>
                <TableHead>Học sinh</TableHead>
                <TableHead>Ngày liên kết</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-8">
                    Chưa có liên kết nào
                  </TableCell>
                </TableRow>
              ) : (
                links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium text-gray-900">
                      <span className="inline-flex items-center gap-1.5">
                        <Heart className="size-3.5 text-red-400" />
                        {link.parentName}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700">{link.childName}</TableCell>
                    <TableCell className="text-gray-500 text-xs">
                      {new Date(link.createdAt).toLocaleDateString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(link.id)}
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
