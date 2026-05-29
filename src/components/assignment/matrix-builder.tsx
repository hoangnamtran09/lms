"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TestMatrix, MatrixCell, COGNITIVE_LEVELS, LEVEL_LABELS, computeTotals, validateMatrix, type ValidationWarning } from "@/lib/test-matrix";

interface Props {
  matrix: TestMatrix;
  onChange: (matrix: TestMatrix) => void;
  totalQuestions?: number;
}

export default function MatrixBuilder({ matrix, onChange, totalQuestions }: Props) {
  const totals = computeTotals(matrix);
  const warnings = validateMatrix(matrix, totalQuestions);

  const updateCell = (topic: string, level: string, field: keyof MatrixCell, value: number) => {
    const cells = { ...matrix.cells };
    cells[topic] = { ...cells[topic] };
    cells[topic][level] = { ...cells[topic][level], [field]: Math.max(0, value || 0) };
    onChange({ ...matrix, cells });
  };

  const addTopic = () => {
    const name = `Chủ đề ${matrix.topics.length + 1}`;
    const cells = { ...matrix.cells };
    cells[name] = {};
    for (const l of COGNITIVE_LEVELS) {
      cells[name][l] = { questionCount: 0, score: 0 };
    }
    onChange({ ...matrix, topics: [...matrix.topics, name], cells });
  };

  const removeTopic = (topic: string) => {
    const topics = matrix.topics.filter((t) => t !== topic);
    const cells = { ...matrix.cells };
    delete cells[topic];
    onChange({ ...matrix, topics, cells });
  };

  const renameTopic = (oldName: string, newName: string) => {
    const topics = matrix.topics.map((t) => (t === oldName ? newName : t));
    const cells: Record<string, Record<string, MatrixCell>> = {};
    for (const t of topics) {
      cells[t] = matrix.cells[t] ?? matrix.cells[oldName] ?? {};
    }
    onChange({ ...matrix, topics, cells });
  };

  const scoreMismatch = matrix.totalScore > 0 && totals.grandTotal.score !== matrix.totalScore;

  return (
    <div className="space-y-3">
      {/* Warnings */}
      {warnings.map((w: ValidationWarning, i: number) => (
        <div
          key={i}
          className={`text-xs px-3 py-2 rounded-lg ${
            w.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          {w.message}
        </div>
      ))}

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-8 text-center text-xs font-bold text-gray-400 uppercase">STT</TableHead>
              <TableHead className="text-xs font-bold text-gray-400 uppercase min-w-[140px]">Chủ đề (vd: Khái niệm, Cách giải...)</TableHead>
              {COGNITIVE_LEVELS.map((l) => (
                <TableHead key={l} className="text-center min-w-[90px]">
                  <div className="text-xs font-bold text-gray-500">{LEVEL_LABELS[l as keyof typeof LEVEL_LABELS]}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">Câu / Điểm</div>
                </TableHead>
              ))}
              <TableHead className="text-center text-xs font-bold text-gray-400 uppercase min-w-[70px]">Tổng</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.topics.map((topic, i) => (
              <TableRow key={topic}>
                <TableCell className="text-center text-sm text-gray-500">{i + 1}</TableCell>
                <TableCell>
                  <Input
                    value={topic}
                    onChange={(e) => renameTopic(topic, e.target.value)}
                    placeholder="Nhập tên chủ đề..."
                    className="h-7 text-sm border-0 bg-transparent hover:bg-gray-50 focus:bg-white px-1 rounded"
                  />
                </TableCell>
                {COGNITIVE_LEVELS.map((level) => {
                  const cell = matrix.cells[topic]?.[level] ?? { questionCount: 0, score: 0 };
                  return (
                    <TableCell key={level} className="p-1.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-8 shrink-0">Câu</span>
                          <Input
                            type="number"
                            min={0}
                            max={99}
                            value={cell.questionCount || ""}
                            onChange={(e) => updateCell(topic, level, "questionCount", parseInt(e.target.value) || 0)}
                            className="flex-1 min-w-0 h-8 text-center text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 w-8 shrink-0">Điểm</span>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            step={0.5}
                            value={cell.score || ""}
                            onChange={(e) => updateCell(topic, level, "score", Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                            className="flex-1 min-w-0 h-8 text-center text-sm"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <div className="text-sm font-semibold">{totals.byTopic[topic]?.questionCount || 0} câu</div>
                  <div className="text-xs text-gray-500">{totals.byTopic[topic]?.score || 0} đ</div>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => removeTopic(topic)}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    title="Xoá chủ đề"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add topic button */}
      <Button variant="outline" size="sm" onClick={addTopic} className="gap-1 rounded-lg text-xs">
        <Plus className="size-3.5" /> Thêm chủ đề
      </Button>

      {/* Totals bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-gray-50 rounded-xl text-sm">
        <div>
          <span className="text-gray-500">Tổng câu:</span>{" "}
          <span className="font-bold">{totals.grandTotal.questionCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500">Tổng điểm:</span>
          <span className={`font-bold ${scoreMismatch ? "text-red-600" : "text-green-600"}`}>
            {totals.grandTotal.score}
          </span>
          <span className="text-gray-400">/</span>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={matrix.totalScore || ""}
            onChange={(e) => onChange({ ...matrix, totalScore: Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)) })}
            className="w-16 h-7 text-center text-sm font-bold"
            placeholder="10"
          />
        </div>
        {COGNITIVE_LEVELS.map((l) => (
          <div key={l}>
            <span className="text-gray-400 text-xs">{LEVEL_LABELS[l as keyof typeof LEVEL_LABELS]}:</span>{" "}
            <span className="font-medium text-xs">{totals.percentageByLevel[l]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
