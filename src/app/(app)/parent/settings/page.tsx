"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, Mail, Shield } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface ChildInfo {
  id: string;
  fullName: string;
  classId: string;
}

export default function ParentSettingsPage() {
  const { user } = useAuth();
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState("");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchChildren = () => {
    api<ChildInfo[]>("/api/parents/children")
      .then(setChildren)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  const handleLink = async () => {
    if (!childId.trim()) return;
    setError("");
    setSuccess("");
    setLinking(true);
    try {
      await api("/api/parents/link", {
        method: "POST",
        body: JSON.stringify({ childId: childId.trim() }),
      });
      setSuccess("Liên kết thành công");
      setChildId("");
      setLoading(true);
      fetchChildren();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Liên kết thất bại");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (childIdToRemove: string) => {
    if (!confirm("Xoá liên kết với học sinh này?")) return;
    try {
      await api(`/api/parents/link/${childIdToRemove}`, { method: "DELETE" });
      fetchChildren();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={100} className="h-20 w-full rounded-lg" />
        <Skeleton delay={200} className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link
        href="/parent"
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 mb-4"
      >
        <ArrowLeft className="size-4" />
        Quay lại
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cài đặt tài khoản</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile card */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <User className="size-4 text-blue-500" />
              Thông tin cá nhân
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-lg font-bold text-red-500">
                  {user?.fullName?.charAt(0)?.toUpperCase() || "P"}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.fullName}</p>
                <Badge variant="outline" className="text-xs mt-0.5">Phụ huynh</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Children management card */}
        <Card className="rounded-xl ring-1 ring-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Shield className="size-4 text-green-500" />
              Học sinh liên kết
            </CardTitle>
          </CardHeader>
          <CardContent>
            {children.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Chưa có học sinh nào được liên kết</p>
            ) : (
              <div className="space-y-2 mb-4">
                {children.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{c.fullName}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlink(c.id)}
                      className="text-red-500 hover:text-red-700 text-xs h-7"
                    >
                      Huỷ liên kết
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Liên kết học sinh mới</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nhập mã học sinh"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="text-sm"
                />
                <Button onClick={handleLink} disabled={linking || !childId.trim()} size="sm">
                  {linking ? "Đang liên kết..." : "Liên kết"}
                </Button>
              </div>
              {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              {success && <p className="text-sm text-green-500 mt-2">{success}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
