// ---- Types ----

export type CognitiveLevel = "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao";

export interface MatrixCell {
  questionCount: number;
  score: number;
}

export interface TestMatrix {
  topics: string[];
  levels: CognitiveLevel[];
  cells: Record<string, Record<string, MatrixCell>>;
  totalQuestions: number;
  totalScore: number;
  purpose: string;
  format: string;
}

export interface MatrixTotals {
  byTopic: Record<string, MatrixCell>;
  byLevel: Record<string, MatrixCell>;
  grandTotal: MatrixCell;
  percentageByLevel: Record<string, number>;
  percentageByTopic: Record<string, number>;
}

// ---- Constants ----

export const COGNITIVE_LEVELS: CognitiveLevel[] = ["nhan_biet", "thong_hieu", "van_dung", "van_dung_cao"];

export const LEVEL_LABELS: Record<CognitiveLevel, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
  van_dung_cao: "Vận dụng cao",
};

export const PURPOSE_LABELS: Record<string, string> = {
  kiem_tra_15p: "Kiểm tra 15 phút",
  kiem_tra_45p: "Kiểm tra 45 phút",
  kiem_tra_giua_ky: "Kiểm tra giữa kỳ",
  kiem_tra_cuoi_ky: "Kiểm tra cuối kỳ",
  bai_tap_ve_nha: "Bài tập về nhà",
};

export const FORMAT_LABELS: Record<string, string> = {
  tnkq: "Trắc nghiệm khách quan",
  tu_luan: "Tự luận",
  ket_hop: "Kết hợp",
};

// MOET recommended distribution by test purpose
export const RECOMMENDED_DISTRIBUTION: Record<string, Record<CognitiveLevel, { min: number; max: number }>> = {
  kiem_tra_15p: {
    nhan_biet: { min: 30, max: 50 },
    thong_hieu: { min: 30, max: 50 },
    van_dung: { min: 10, max: 30 },
    van_dung_cao: { min: 0, max: 10 },
  },
  kiem_tra_45p: {
    nhan_biet: { min: 20, max: 35 },
    thong_hieu: { min: 25, max: 40 },
    van_dung: { min: 20, max: 35 },
    van_dung_cao: { min: 5, max: 15 },
  },
  kiem_tra_giua_ky: {
    nhan_biet: { min: 15, max: 30 },
    thong_hieu: { min: 25, max: 40 },
    van_dung: { min: 20, max: 35 },
    van_dung_cao: { min: 10, max: 20 },
  },
  kiem_tra_cuoi_ky: {
    nhan_biet: { min: 10, max: 25 },
    thong_hieu: { min: 20, max: 35 },
    van_dung: { min: 25, max: 40 },
    van_dung_cao: { min: 15, max: 30 },
  },
  bai_tap_ve_nha: {
    nhan_biet: { min: 20, max: 40 },
    thong_hieu: { min: 20, max: 40 },
    van_dung: { min: 20, max: 40 },
    van_dung_cao: { min: 0, max: 20 },
  },
};

// ---- Utility functions ----

export function createEmptyMatrix(topics: string[], totalScore = 10): TestMatrix {
  const levels = [...COGNITIVE_LEVELS];
  const cells: Record<string, Record<string, MatrixCell>> = {};
  for (const t of topics) {
    cells[t] = {};
    for (const l of levels) {
      cells[t][l] = { questionCount: 0, score: 0 };
    }
  }
  return { topics, levels, cells, totalQuestions: 0, totalScore, purpose: "", format: "ket_hop" };
}

export function computeTotals(matrix: TestMatrix): MatrixTotals {
  const byTopic: Record<string, MatrixCell> = {};
  const byLevel: Record<string, MatrixCell> = {};
  let grandQuestionCount = 0;
  let grandScore = 0;

  for (const l of matrix.levels) {
    byLevel[l] = { questionCount: 0, score: 0 };
    for (const t of matrix.topics) {
      const cell = matrix.cells[t]?.[l] ?? { questionCount: 0, score: 0 };
      byLevel[l].questionCount += cell.questionCount;
      byLevel[l].score += cell.score;
      grandQuestionCount += cell.questionCount;
      grandScore += cell.score;
    }
  }

  for (const t of matrix.topics) {
    byTopic[t] = { questionCount: 0, score: 0 };
    for (const l of matrix.levels) {
      const cell = matrix.cells[t]?.[l] ?? { questionCount: 0, score: 0 };
      byTopic[t].questionCount += cell.questionCount;
      byTopic[t].score += cell.score;
    }
  }

  const percentageByLevel: Record<string, number> = {};
  const percentageByTopic: Record<string, number> = {};
  for (const l of matrix.levels) {
    percentageByLevel[l] = grandScore > 0 ? Math.round((byLevel[l].score / grandScore) * 100) : 0;
  }
  for (const t of matrix.topics) {
    percentageByTopic[t] = grandScore > 0 ? Math.round((byTopic[t].score / grandScore) * 100) : 0;
  }

  return {
    byTopic,
    byLevel,
    grandTotal: { questionCount: grandQuestionCount, score: grandScore },
    percentageByLevel,
    percentageByTopic,
  };
}

export interface ValidationWarning {
  type: "error" | "warning";
  message: string;
}

export function validateMatrix(
  matrix: TestMatrix,
  targetQuestions?: number
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const totals = computeTotals(matrix);

  if (matrix.topics.length === 0) {
    warnings.push({ type: "error", message: "Cần ít nhất một chủ đề" });
  }

  if (totals.grandTotal.questionCount === 0) {
    warnings.push({ type: "error", message: "Cần ít nhất một câu hỏi" });
  }

  if (matrix.totalScore > 0 && totals.grandTotal.score !== matrix.totalScore) {
    const diff = matrix.totalScore - totals.grandTotal.score;
    warnings.push({
      type: "error",
      message:
        diff > 0
          ? `Còn thiếu ${diff.toFixed(1)} điểm so với tổng ${matrix.totalScore}`
          : `Dư ${Math.abs(diff).toFixed(1)} điểm so với tổng ${matrix.totalScore}`,
    });
  }

  if (targetQuestions && totals.grandTotal.questionCount !== targetQuestions) {
    warnings.push({
      type: "warning",
      message: `Số câu hỏi hiện tại (${totals.grandTotal.questionCount}) khác với số câu đã chọn (${targetQuestions})`,
    });
  }

  // Check Vận dụng cao column has at least some questions for exams
  if (
    matrix.purpose &&
    matrix.purpose !== "bai_tap_ve_nha" &&
    (totals.byLevel["van_dung_cao"]?.questionCount ?? 0) === 0
  ) {
    warnings.push({
      type: "warning",
      message: "Nên có ít nhất 1 câu hỏi vận dụng cao cho bài kiểm tra",
    });
  }

  // Check recommended distribution
  if (matrix.purpose && RECOMMENDED_DISTRIBUTION[matrix.purpose]) {
    const rec = RECOMMENDED_DISTRIBUTION[matrix.purpose];
    for (const level of matrix.levels) {
      const pct = totals.percentageByLevel[level] ?? 0;
      const range = rec[level as CognitiveLevel] ?? rec[level as keyof typeof rec];
      if (range && (pct < range.min || pct > range.max)) {
        warnings.push({
          type: "warning",
          message: `Tỉ lệ "${LEVEL_LABELS[level as CognitiveLevel] || level}" (${pct}%) nằm ngoài khuyến nghị (${range.min}-${range.max}%) cho ${PURPOSE_LABELS[matrix.purpose] || matrix.purpose}`,
        });
        break; // chỉ báo 1 warning về phân bổ
      }
    }
  }

  return warnings;
}

export function matrixToAIInstruction(matrix: TestMatrix): string {
  const totals = computeTotals(matrix);
  const lines: string[] = ["Hãy tạo đề kiểm tra theo MA TRẬN sau:"];

  if (matrix.purpose) {
    lines.push(`- Mục đích: ${PURPOSE_LABELS[matrix.purpose] || matrix.purpose}`);
  }
  if (matrix.format) {
    lines.push(`- Hình thức: ${FORMAT_LABELS[matrix.format] || matrix.format}`);
  }

  lines.push("");
  for (const topic of matrix.topics) {
    lines.push(`CHỦ ĐỀ: "${topic}"`);
    for (const level of matrix.levels) {
      const cell = matrix.cells[topic]?.[level];
      if (cell && cell.questionCount > 0) {
        lines.push(
          `  - ${LEVEL_LABELS[level as CognitiveLevel] || level}: ${cell.questionCount} câu (tổng ${cell.score} điểm)`
        );
      }
    }
  }

  lines.push("");
  lines.push(`TỔNG: ${totals.grandTotal.questionCount} câu, ${totals.grandTotal.score} điểm`);
  lines.push("");
  lines.push("YÊU CẦU BẮT BUỘC:");
  lines.push("1. Mỗi câu hỏi PHẢI có trường \"topic\" ghi đúng tên chủ đề");
  lines.push("2. Mỗi câu hỏi PHẢI có trường \"difficulty\" đúng cấp độ (nhan_biet/thong_hieu/van_dung/van_dung_cao)");
  lines.push("3. Điểm từng câu theo đúng phân bổ trong ma trận");
  lines.push("4. Số lượng câu hỏi mỗi chủ đề + cấp độ PHẢI khớp chính xác với ma trận");

  return lines.join("\n");
}
