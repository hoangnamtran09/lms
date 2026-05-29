"use client";

import { TestMatrix, COGNITIVE_LEVELS, LEVEL_LABELS, RECOMMENDED_DISTRIBUTION, computeTotals, type CognitiveLevel } from "@/lib/test-matrix";

interface Props {
  matrix: TestMatrix;
}

const LEVEL_COLORS: Record<string, string> = {
  nhan_biet: "bg-emerald-400",
  thong_hieu: "bg-blue-400",
  van_dung: "bg-orange-400",
  van_dung_cao: "bg-red-400",
};

export default function MatrixSummary({ matrix }: Props) {
  const totals = computeTotals(matrix);
  const hasData = totals.grandTotal.score > 0;

  if (!hasData) {
    return (
      <p className="text-xs text-gray-400 italic">Nhập số câu và điểm vào ma trận để xem phân bổ.</p>
    );
  }

  const rec =
    matrix.purpose && RECOMMENDED_DISTRIBUTION[matrix.purpose]
      ? RECOMMENDED_DISTRIBUTION[matrix.purpose]
      : null;

  return (
    <div className="space-y-3 p-4 bg-white rounded-xl border">
      <h4 className="text-sm font-bold text-gray-700">Phân bổ điểm theo cấp độ nhận thức</h4>

      {/* Bar chart */}
      <div className="space-y-2">
        {COGNITIVE_LEVELS.map((level) => {
          const pct = totals.percentageByLevel[level] || 0;
          const range = rec ? rec[level as CognitiveLevel] : null;
          const inRange = range && pct >= range.min && pct <= range.max;

          return (
            <div key={level} className="flex items-center gap-3">
              <span className="w-28 text-xs text-gray-600 shrink-0">{LEVEL_LABELS[level as keyof typeof LEVEL_LABELS]}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${LEVEL_COLORS[level]}`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
                {range && (
                  <div
                    className="absolute top-0 h-full border-x-2 border-gray-400/30"
                    style={{
                      left: `${range.min}%`,
                      width: `${range.max - range.min}%`,
                    }}
                    title={`Khuyến nghị: ${range.min}-${range.max}%`}
                  />
                )}
              </div>
              <span className={`w-10 text-right text-xs font-bold ${inRange === false ? "text-amber-600" : "text-gray-700"}`}>
                {pct}%
              </span>
              {range && (
                <span className="w-20 text-right text-[10px] text-gray-400">
                  {inRange === false ? `(${range.min}-${range.max}%)` : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span>▯ Khung khuyến nghị của BGDĐT</span>
      </div>
    </div>
  );
}
