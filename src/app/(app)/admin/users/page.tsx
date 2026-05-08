"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/components/auth/auth-provider";

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  classId: string;
  createdAt: string;
}

const roleOptions = [
  { value: "STUDENT", label: "Học sinh" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "PARENT", label: "Phụ huynh" },
  { value: "ADMIN", label: "Admin" },
  { value: "SUPER_ADMIN", label: "Quản trị viên" },
];

const roleBadge: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  SUPER_ADMIN: "destructive",
  ADMIN: "default",
  TEACHER: "secondary",
  PARENT: "outline",
  STUDENT: "outline",
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "STUDENT",
    classId: "",
  });

  const fetchUsers = () => {
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    api<UserRow[]>(`/api/users?${params}`)
      .then(setUsers)
      .catch(() => {});
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  useEffect(() => {
    if (users.length > 0) setLoading(false);
  }, [users]);

  const handleCreate = async () => {
    setError("");
    setSaving(true);
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ username: "", password: "", fullName: "", email: "", role: "STUDENT", classId: "" });
      setLoading(true);
      fetchUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tạo thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    await api(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    fetchUsers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá người dùng này?")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full rounded-lg" />
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
            <ArrowLeft className="size-4" />
            Quay lại
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Người dùng</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button><Plus className="size-4" />Thêm người dùng</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo người dùng mới</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="fullName">Họ tên</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="role">Vai trò</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v || "STUDENT" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="classId">Mã lớp</Label>
                <Input
                  id="classId"
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? "Đang tạo..." : "Tạo người dùng"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role filter */}
      <div className="flex gap-2 mb-4">
        <Badge
          variant={roleFilter === "" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setRoleFilter("")}
        >
          Tất cả
        </Badge>
        {roleOptions.map((r) => (
          <Badge
            key={r.value}
            variant={roleFilter === r.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setRoleFilter(r.value)}
          >
            {r.label}
          </Badge>
        ))}
      </div>

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Tên đăng nhập</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Lớp</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    Không có người dùng nào
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-gray-900">{u.fullName}</TableCell>
                    <TableCell className="text-gray-500">{u.username}</TableCell>
                    <TableCell className="text-gray-500">{u.email || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => v && handleRoleChange(u.id, v)}
                        disabled={u.id === me?.id}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-gray-500">{u.classId || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === me?.id}
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
