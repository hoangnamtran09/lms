"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { MaterialIcon } from "@/components/ui/material-icon";

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

export default function TeacherParentsPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [parents, setParents] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<UserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ parentId: "", childId: "" });

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
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
        <Skeleton delay={0} className="h-10 w-56 mb-8" />
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[1,2,3].map((i) => <Skeleton key={i} delay={80+i*60} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton delay={300} className="h-60 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-[1280px] mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Link href="/teacher" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2">
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h2 className="text-[32px] font-bold tracking-[-0.02em] text-gray-900">Quản lý phụ huynh</h2>
          <p className="text-sm text-gray-500 mt-1">Theo dõi và quản lý thông tin liên lạc của các bậc phụ huynh trong hệ thống.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/parents/new">
            <Button className="shadow-lg shadow-primary/20 rounded-xl"><UserPlus className="size-4 mr-1.5" />Tạo phụ huynh</Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="shadow-lg shadow-primary/20 rounded-xl"><Plus className="size-4" />Thêm liên kết</Button>} />
            <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl [&>button]:top-4 [&>button]:right-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-xl font-bold text-primary">Liên kết Phụ huynh - Học sinh</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Phụ huynh <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MaterialIcon name="family_restroom" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl z-10" />
                    <select
                      value={form.parentId}
                      onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                    >
                      <option value="">Chọn phụ huynh</option>
                      {parents.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Học sinh <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MaterialIcon name="person_search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl z-10" />
                    <select
                      value={form.childId}
                      onChange={(e) => setForm({ ...form, childId: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                    >
                      <option value="">Chọn học sinh</option>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-3">
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Hủy</Button>
                <Button onClick={handleCreate} disabled={saving || !form.parentId || !form.childId} className="rounded-xl shadow-md">
                  {saving ? "Đang tạo..." : "Tạo liên kết"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary transition-transform group-hover:scale-110">
              <MaterialIcon name="people" className="text-[28px]" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Tổng số phụ huynh</p>
            <p className="text-3xl font-bold text-gray-900">{parents.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 transition-transform group-hover:scale-110">
              <MaterialIcon name="link" className="text-[28px]" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Tài khoản đã kết nối</p>
            <p className="text-3xl font-bold text-gray-900">{links.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-start justify-between">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 transition-transform group-hover:scale-110">
              <MaterialIcon name="family_restroom" className="text-[28px]" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Học sinh được liên kết</p>
            <p className="text-3xl font-bold text-gray-900">{new Set(links.map((l) => l.childId)).size}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton className="h-40 w-full" /></div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Phụ huynh</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Học sinh</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Ngày liên kết</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500 text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-12">Chưa có liên kết nào</TableCell>
                  </TableRow>
                ) : (
                  links.map((link) => (
                    <TableRow key={link.id} className="group hover:bg-gray-50/70 transition-colors">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {link.parentName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <span className="font-medium text-gray-900">{link.parentName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                            {link.childName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                          </div>
                          <span className="text-sm text-gray-700">{link.childName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 text-sm text-gray-500">
                        {new Date(link.createdAt).toLocaleDateString("vi-VN")}
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)} className="text-red-500 hover:bg-red-50 rounded-lg" title="Xoá liên kết">
                            <MaterialIcon name="delete" className="text-xl" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Hiển thị {links.length} liên kết</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
