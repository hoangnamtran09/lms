"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Pencil, Check, X, Plus, ChevronUp, Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AchievementItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  ruleType: string;
  threshold: number;
  diamondReward: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const ICON_OPTIONS = [
  { value: "Trophy", label: "Cúp vàng", emoji: "🏆" },
  { value: "Star", label: "Ngôi sao", emoji: "⭐" },
  { value: "Medal", label: "Huy chương", emoji: "🏅" },
  { value: "Flame", label: "Ngọn lửa", emoji: "🔥" },
  { value: "Gem", label: "Kim cương", emoji: "💎" },
  { value: "Crown", label: "Vương miện", emoji: "👑" },
  { value: "Rocket", label: "Tên lửa", emoji: "🚀" },
  { value: "Fire", label: "Hào quang", emoji: "✨" },
  { value: "Ribbon", label: "Ruy băng", emoji: "🎀" },
  { value: "Lightning", label: "Tia chớp", emoji: "⚡" },
  { value: "Target", label: "Mục tiêu", emoji: "🎯" },
  { value: "BookOpen", label: "Sách vở", emoji: "📖" },
  { value: "Zap", label: "Năng lượng", emoji: "💥" },
  { value: "Award", label: "Giải thưởng", emoji: "🎖️" },
];

const RULE_TYPE_OPTIONS = [
  { value: "study_streak", label: "Duy trì học tập" },
  { value: "lessons_completed", label: "Hoàn thành bài học" },
  { value: "quizzes_passed", label: "Vượt qua bài kiểm tra" },
  { value: "assignments_done", label: "Hoàn thành bài tập" },
  { value: "diamonds_earned", label: "Tích luỹ kim cương" },
];

const RULE_TYPE_LABELS: Record<string, string> = {
  study_streak: "Duy trì học tập",
  lessons_completed: "Hoàn thành bài học",
  quizzes_passed: "Vượt qua bài kiểm tra",
  assignments_done: "Hoàn thành bài tập",
  diamonds_earned: "Tích luỹ kim cương",
};

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editRuleType, setEditRuleType] = useState("");
  const [editThreshold, setEditThreshold] = useState(0);
  const [editDiamondReward, setEditDiamondReward] = useState(0);
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("Trophy");
  const [newRuleType, setNewRuleType] = useState("study_streak");
  const [newThreshold, setNewThreshold] = useState(1);
  const [newDiamondReward, setNewDiamondReward] = useState(0);
  const [newIsActive, setNewIsActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAchievements = () => {
    api<AchievementItem[]>("/api/achievements")
      .then(setAchievements)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAchievements() }, []);

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewIcon("Trophy");
    setNewRuleType("study_streak");
    setNewThreshold(1);
    setNewDiamondReward(0);
    setNewIsActive(true);
  };

  const startEdit = (a: AchievementItem) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditDescription(a.description);
    setEditIcon(a.icon);
    setEditRuleType(a.ruleType);
    setEditThreshold(a.threshold);
    setEditDiamondReward(a.diamondReward);
    setEditIsActive(a.isActive);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };

  const handleSave = async (id: string) => {
    if (!editTitle.trim()) {
      setEditError("Tiêu đề không được để trống");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      await api(`/api/achievements/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          icon: editIcon,
          ruleType: editRuleType,
          threshold: editThreshold,
          diamondReward: editDiamondReward,
          isActive: editIsActive,
        }),
      });
      cancelEdit();
      fetchAchievements();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xoá thành tựu này?")) return;
    try {
      await api(`/api/achievements/${id}`, { method: "DELETE" });
      fetchAchievements();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Xoá thất bại");
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      setCreateError("Tiêu đề không được để trống");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await api("/api/achievements", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          icon: newIcon,
          ruleType: newRuleType,
          threshold: newThreshold,
          diamondReward: newDiamondReward,
          isActive: newIsActive,
        }),
      });
      resetCreateForm();
      setShowCreateForm(false);
      fetchAchievements();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Tạo thành tựu thất bại");
    } finally {
      setCreating(false);
    }
  };

  const getIconDisplay = (icon: string) => {
    const opt = ICON_OPTIONS.find((o) => o.value === icon);
    return opt ? `${opt.emoji} ${opt.label}` : `🏆 ${icon}`;
  };

  const getRuleTypeDisplay = (ruleType: string) => {
    return RULE_TYPE_LABELS[ruleType] || ruleType;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton delay={0} className="h-8 w-48" />
        <Skeleton delay={120} className="h-60 w-full rounded-lg" />
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
            <ArrowLeft className="size-4" /> Quay lại
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Quản lí Thành tựu</h1>
          <p className="text-base text-gray-500 mt-1">{achievements.length} thành tựu</p>
        </div>
        <Button onClick={() => { setShowCreateForm(!showCreateForm); setCreateError(null); }} className="gap-2">
          {showCreateForm ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
          {showCreateForm ? "Thu gọn" : "Tạo thành tựu"}
        </Button>
      </div>

      {createError && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{createError}</div>
      )}

      {showCreateForm && (
        <Card className="rounded-2xl border-0 ring-1 ring-gray-200/60 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center justify-center size-8 rounded-lg bg-amber-100">
                <Trophy className="size-4 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Tạo thành tựu mới</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-title">Tiêu đề</Label>
                  <Input
                    id="new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="VD: Cao thủ học tập"
                  />
                </div>
                <div>
                  <Label htmlFor="new-description">Mô tả</Label>
                  <Textarea
                    id="new-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Mô tả thành tựu này"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="new-icon">Biểu tượng</Label>
                  <Select value={newIcon} onValueChange={(v) => setNewIcon(v || "Trophy")}>
                    <SelectTrigger>
                      <SelectValue>{getIconDisplay(newIcon)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-rule-type">Loại quy tắc</Label>
                  <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v || "study_streak")}>
                    <SelectTrigger>
                      <SelectValue>{getRuleTypeDisplay(newRuleType)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-threshold">Ngưỡng đạt được</Label>
                  <Input
                    id="new-threshold"
                    type="number"
                    min={1}
                    value={newThreshold}
                    onChange={(e) => setNewThreshold(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="new-diamond-reward">Thưởng kim cương</Label>
                  <Input
                    id="new-diamond-reward"
                    type="number"
                    min={0}
                    value={newDiamondReward}
                    onChange={(e) => setNewDiamondReward(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setNewIsActive(!newIsActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newIsActive ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block size-4 rounded-full bg-white transition-transform ${newIsActive ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                  <Label>Kích hoạt</Label>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleCreate} disabled={creating} className="gap-2">
                    <Plus className="size-4" />
                    {creating ? "Đang tạo..." : "Tạo thành tựu"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreateForm(false); setCreateError(null); }}>
                    Huỷ
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editError && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg text-sm text-red-600">{editError}</div>
      )}

      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-sm">Biểu tượng</TableHead>
                <TableHead className="text-sm">Tiêu đề</TableHead>
                <TableHead className="text-sm">Loại quy tắc</TableHead>
                <TableHead className="text-sm">Ngưỡng</TableHead>
                <TableHead className="text-sm">Thưởng</TableHead>
                <TableHead className="text-sm">Trạng thái</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                    Không có thành tựu nào
                  </TableCell>
                </TableRow>
              ) : (
                achievements.map((a) => {
                  const isEditing = editingId === a.id;
                  return (
                    <TableRow key={a.id} className={isEditing ? "bg-blue-50/50" : ""}>
                      <TableCell>
                        {isEditing ? (
                          <Select value={editIcon} onValueChange={(v) => setEditIcon(v || "Trophy")}>
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue>{getIconDisplay(editIcon)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.emoji} {opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xl">{getIconDisplay(a.icon)}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900 text-base">
                        {isEditing ? (
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-9 text-sm"
                          />
                        ) : (
                          <div>
                            <p className="font-medium">{a.title}</p>
                            {a.description && (
                              <p className="text-sm text-gray-500 truncate max-w-[200px]">{a.description}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-base">
                        {isEditing ? (
                          <Select value={editRuleType} onValueChange={(v) => setEditRuleType(v || "study_streak")}>
                            <SelectTrigger className="h-9 text-sm w-40">
                              <SelectValue>{getRuleTypeDisplay(editRuleType)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {RULE_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-sm">
                            {RULE_TYPE_LABELS[a.ruleType] || a.ruleType}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-900 font-medium text-base">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={1}
                            value={editThreshold}
                            onChange={(e) => setEditThreshold(Number(e.target.value))}
                            className="h-9 text-sm w-20"
                          />
                        ) : (
                          a.threshold
                        )}
                      </TableCell>
                      <TableCell className="text-gray-900 font-medium text-base">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={0}
                            value={editDiamondReward}
                            onChange={(e) => setEditDiamondReward(Number(e.target.value))}
                            className="h-9 text-sm w-20"
                          />
                        ) : (
                          a.diamondReward > 0 ? `💎 ${a.diamondReward}` : "—"
                        )}
                      </TableCell>
                      <TableCell className="text-base">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditIsActive(!editIsActive)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editIsActive ? "bg-emerald-500" : "bg-gray-300"}`}
                            >
                              <span className={`inline-block size-3.5 rounded-full bg-white transition-transform ${editIsActive ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                            </button>
                            <span className="text-sm text-gray-500">{editIsActive ? "Bật" : "Tắt"}</span>
                          </div>
                        ) : (
                          <Badge className={a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-500"}>
                            {a.isActive ? "Hoạt động" : "Tắt"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSave(a.id)}
                                disabled={saving}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <Check className="size-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEdit}
                                disabled={saving}
                              >
                                <X className="size-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(a)}
                                disabled={editingId !== null}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(a.id)}
                                disabled={editingId !== null}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
