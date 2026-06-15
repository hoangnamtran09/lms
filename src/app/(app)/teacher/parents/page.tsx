"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, UserPlus, Key, Eye, EyeOff, Search, Link2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
  email?: string;
  phone?: string;
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
  const [search, setSearch] = useState("");

  // Password reset
  const [pwDialog, setPwDialog] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const fetchLinks = () => {
    api<LinkRow[]>("/api/teacher/parent-links")
      .then(setLinks)
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      api<LinkRow[]>("/api/teacher/parent-links"),
      api<UserRow[]>("/api/users?role=PARENT"),
      api<UserRow[]>("/api/users?role=STUDENT"),
    ])
      .then(([l, p, s]) => { setLinks(l); setParents(p); setStudents(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setError(""); setSaving(true);
    try {
      await api("/api/teacher/link-parent", { method: "POST", body: JSON.stringify(form) });
      setOpen(false); setForm({ parentId: "", childId: "" }); fetchLinks();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Tạo thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá liên kết này?")) return;
    try { await api(`/api/teacher/parent-links/${id}`, { method: "DELETE" }); fetchLinks(); }
    catch (err) { alert(err instanceof ApiError ? err.message : "Xoá thất bại"); }
  };

  const handleResetPassword = async () => {
    if (!pwTarget || newPassword.length < 6) return;
    setPwError(""); setPwSuccess(""); setResetting(true);
    try {
      await api(`/api/teacher/parents/${pwTarget.id}/reset-password`, {
        method: "POST", body: JSON.stringify({ newPassword }),
      });
      setPwSuccess("Đổi mật khẩu thành công!");
      setTimeout(() => { setPwDialog(false); setNewPassword(""); setPwSuccess(""); }, 1500);
    } catch (err) { setPwError(err instanceof ApiError ? err.message : "Lỗi đổi mật khẩu"); }
    finally { setResetting(false); }
  };

  const connectedCount = new Set(links.map(l => l.parentId)).size;
  const connectionPct = parents.length > 0 ? Math.round((connectedCount / parents.length) * 100) : 0;

  const filteredParents = parents.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    const childNames = links.filter(l => l.parentId === p.id).map(l => l.childName.toLowerCase());
    return p.fullName.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      childNames.some(n => n.includes(q));
  });

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-8 animate-fade-in">
        <Skeleton delay={0} className="h-10 w-56 mb-8" />
        <div className="grid grid-cols-3 gap-6 mb-8">
          {[1,2,3].map(i => <Skeleton key={i} delay={80+i*60} className="h-28 rounded-2xl" />)}
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
          <p className="text-gray-500 mt-1">Xem danh sách thông tin liên lạc và tình trạng kết nối của phụ huynh học sinh.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/parents/new">
            <Button className="shadow-lg shadow-primary/20 rounded-xl gap-2"><UserPlus className="size-4" />Thêm phụ huynh</Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="shadow-lg shadow-primary/20 rounded-xl gap-2"><Plus className="size-4" />Thêm liên kết</Button>} />
            <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden rounded-2xl [&>button]:top-4 [&>button]:right-4">
              <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-xl font-bold text-primary">Liên kết Phụ huynh - Học sinh</h3></div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Phụ huynh <span className="text-red-500">*</span></label>
                  <select value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm">
                    <option value="">Chọn phụ huynh</option>
                    {parents.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Học sinh <span className="text-red-500">*</span></label>
                  <select value={form.childId} onChange={e => setForm({...form, childId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm">
                    <option value="">Chọn học sinh</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </select>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-3">
                <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Hủy</Button>
                <Button onClick={handleCreate} disabled={saving || !form.parentId || !form.childId} className="rounded-xl shadow-md">{saving ? "Đang tạo..." : "Tạo liên kết"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="mb-4"><div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center"><MaterialIcon name="group" className="text-[28px]" /></div></div>
            <h3 className="text-gray-500 text-sm mb-1">Tổng số phụ huynh</h3>
            <p className="text-3xl font-bold text-gray-900">{parents.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center"><MaterialIcon name="link" className="text-[28px]" /></div>
              <span className="text-gray-400 text-xs font-bold uppercase">{connectionPct}% kết nối</span>
            </div>
            <h3 className="text-gray-500 text-sm mb-1">Tài khoản đã kết nối</h3>
            <p className="text-3xl font-bold text-gray-900 mb-4">{connectedCount}</p>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${connectionPct}%` }} />
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group overflow-hidden relative">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative">
            <div className="mb-4"><div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center"><MaterialIcon name="family_restroom" className="text-[28px]" /></div></div>
            <h3 className="text-gray-500 text-sm mb-1">Liên kết đã tạo</h3>
            <p className="text-3xl font-bold text-gray-900">{links.length}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none"
            placeholder="Tìm theo tên, email hoặc tên con..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Phụ huynh</th>
                <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Học sinh (Con)</th>
                <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Liên hệ</th>
                <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Ngày liên kết</th>
                <th className="px-6 py-4 font-bold text-gray-500 text-xs uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredParents.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-gray-400 py-12">Không tìm thấy phụ huynh nào</td></tr>
              ) : (
                filteredParents.map(p => {
                  const parentLinks = links.filter(l => l.parentId === p.id);
                  if (parentLinks.length === 0) {
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                              {p.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                            </div>
                            <div><Link href={`/teacher/parents/${p.id}`} className="font-semibold text-gray-900 text-sm hover:text-primary hover:underline inline-flex items-center gap-1">{p.fullName} <MaterialIcon name="open_in_new" className="text-sm text-gray-400" /></Link><p className="text-xs text-gray-400">{p.email || "—"}</p></div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-xs text-gray-400 italic">Chưa liên kết</span></td>
                        <td className="px-6 py-4 text-sm text-gray-500">{p.phone || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-400">—</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setForm({ parentId: p.id, childId: "" }); setError(""); setOpen(true); }}
                              className="text-blue-600 hover:bg-blue-50 rounded-lg" title="Liên kết học sinh"><Link2 className="size-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { setPwTarget(p); setNewPassword(""); setPwError(""); setPwSuccess(""); setPwDialog(true); }}
                              className="text-amber-600 hover:bg-amber-50 rounded-lg" title="Đổi mật khẩu"><Key className="size-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return parentLinks.map((link, idx) => (
                    <tr key={link.id} className="hover:bg-gray-50/50 transition-colors">
                      {idx === 0 && (
                        <td className="px-6 py-4" rowSpan={parentLinks.length}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
                              {p.fullName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                            </div>
                            <div><Link href={`/teacher/parents/${p.id}`} className="font-semibold text-gray-900 text-sm hover:text-primary hover:underline inline-flex items-center gap-1">{p.fullName} <MaterialIcon name="open_in_new" className="text-sm text-gray-400" /></Link><p className="text-xs text-gray-400">{p.email || "—"}</p></div>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4"><p className="font-medium text-gray-900 text-sm">{link.childName}</p></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.phone || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{link.createdAt ? new Date(link.createdAt).toLocaleDateString("vi-VN") : "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          {idx === 0 && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setForm({ parentId: p.id, childId: "" }); setError(""); setOpen(true); }}
                                className="text-blue-600 hover:bg-blue-50 rounded-lg" title="Thêm liên kết"><Link2 className="size-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => { setPwTarget(p); setNewPassword(""); setPwError(""); setPwSuccess(""); setPwDialog(true); }}
                                className="text-amber-600 hover:bg-amber-50 rounded-lg" title="Đổi mật khẩu"><Key className="size-4" /></Button>
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)}
                            className="text-red-500 hover:bg-red-50 rounded-lg" title="Xoá liên kết"><MaterialIcon name="delete" className="text-xl" /></Button>
                        </div>
                      </td>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100">
          <p className="text-sm text-gray-500">Hiển thị {filteredParents.length} phụ huynh · {links.length} liên kết</p>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={pwDialog} onOpenChange={setPwDialog}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl [&>button]:top-4 [&>button]:right-4">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-xl font-bold text-primary">Đổi mật khẩu phụ huynh</h3></div>
          <div className="p-6 space-y-4">
            {pwTarget && (
              <div className="p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
                Đổi mật khẩu cho: <span className="font-bold">{pwTarget.fullName}</span>
                {pwTarget.email && <span className="block text-xs text-blue-500 mt-0.5">{pwTarget.email}</span>}
              </div>
            )}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Mật khẩu mới</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" className="pr-10 rounded-xl" />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {pwError && <p className="text-sm text-red-500">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-emerald-600 font-medium">{pwSuccess}</p>}
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-3">
            <Button variant="outline" onClick={() => setPwDialog(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 6} className="rounded-xl shadow-md">
              {resetting ? "Đang đổi..." : "Đổi mật khẩu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
