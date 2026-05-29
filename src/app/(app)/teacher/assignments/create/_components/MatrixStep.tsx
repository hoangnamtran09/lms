"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import MatrixBuilder from "@/components/assignment/matrix-builder";
import MatrixSummary from "./MatrixSummary";
import { TestMatrix, createEmptyMatrix, PURPOSE_LABELS, FORMAT_LABELS, matrixToAIInstruction } from "@/lib/test-matrix";

interface Props {
  questionCount: number;
  onGenerate: (matrix: TestMatrix) => void;
  onSkip: () => void;
  loading: boolean;
}

export default function MatrixStep({ questionCount, onGenerate, onSkip, loading }: Props) {
  const [purpose, setPurpose] = useState("");
  const [format, setFormat] = useState("ket_hop");
  const [matrix, setMatrix] = useState<TestMatrix>(() =>
    createEmptyMatrix(["Nhận biết khái niệm", "Vận dụng & bài tập"], 10)
  );

  const handleGenerate = () => {
    const m = { ...matrix, purpose, format };
    onGenerate(m);
  };

  return (
    <div className="space-y-6">
      {/* Purpose + Format */}
      <div className="flex flex-wrap items-end gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
        <div className="w-48">
          <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Mục đích kiểm tra</Label>
          <Select value={purpose} onValueChange={(v) => { setPurpose(v ?? ""); if (v) setMatrix((m) => ({ ...m, purpose: v })); }}>
            <SelectTrigger className="rounded-xl w-full"><SelectValue placeholder="Chọn mục đích..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48">
          <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5 block">Hình thức</Label>
          <Select value={format} onValueChange={(v) => { setFormat(v ?? "ket_hop"); setMatrix((m) => ({ ...m, format: v ?? "ket_hop" })); }}>
            <SelectTrigger className="rounded-xl w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FORMAT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-gray-400 pb-2">
          Mục đích giúp gợi ý phân bổ câu hỏi theo chuẩn BGDĐT
        </div>
      </div>

      {/* Matrix Builder */}
      <div>
        <Label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Ma trận đề</Label>
        <p className="text-xs text-gray-400 mb-3">Chia bài học thành các chủ đề kiến thức, phân bổ số câu và điểm cho từng cấp độ nhận thức.</p>
        <MatrixBuilder
          matrix={matrix}
          onChange={setMatrix}
        />
      </div>

      {/* Summary */}
      <MatrixSummary matrix={{ ...matrix, purpose, format }} />

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleGenerate} disabled={loading} className="gap-2 rounded-xl">
          {loading ? "Đang tạo..." : <><Sparkles className="size-4" /> Tạo câu hỏi theo ma trận</>}
        </Button>
        <Button variant="outline" onClick={onSkip} className="gap-2 rounded-xl">
          Bỏ qua, tạo tự động <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
