// Types & constants dùng chung cho assignments/[id] — student view.

export interface Assignment {
  id: string;
  title: string;
  description: string;
  rubric: string;
  maxScore: number;
  dueDate: string;
  status: string;
  source: string;
  creatorName: string;
  questions: string;
  createdAt: string;
}

export interface McqOption {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  question: string;
  expectedAnswer: string;
  score: number;
  type?: "mcq" | "short_answer";
  difficulty?: string;
  options?: McqOption[];
  explanation?: string;
}

export interface QuestionResult {
  questionId: string;
  question: string;
  score: number;
  maxScore: number;
  feedback: string;
  correctAnswer?: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  content: string;
  fileUrl: string;
  score: number | null;
  feedback: string;
  status: string;
  submittedAt: string;
  gradedAt: string | null;
  gradedBy: string;
}

export const difficultyLabels: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
};

export const difficultyColors: Record<string, string> = {
  nhan_biet: "bg-emerald-50 text-emerald-700 border-emerald-200",
  thong_hieu: "bg-blue-50 text-blue-700 border-blue-200",
  van_dung: "bg-orange-50 text-orange-700 border-orange-200",
};

export const statusLabel: Record<string, string> = {
  SUBMITTED: "Đã nộp",
  GRADED: "Đã chấm",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

export const statusColor: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  GRADED: "bg-emerald-100 text-emerald-700",
  RETURNED: "bg-orange-100 text-orange-700",
  ACCEPTED: "bg-teal-100 text-teal-700",
};
