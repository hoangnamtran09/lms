// Types & constants dùng chung cho teacher/assignments/[id]
// Tách ra từ page.tsx để giảm kích thước file chính.

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
  classId?: string;
  studentIds?: string;
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

export interface ClassItem {
  id: string;
  name: string;
}

export interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
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
  DRAFT: "Bản nháp",
  ASSIGNED: "Đã giao",
  SUBMITTED: "Đang nhận bài",
  GRADED: "Đã chấm xong",
  RETURNED: "Cần sửa lại",
  ACCEPTED: "Đã duyệt",
};

export const statusStyle: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-50 text-blue-700",
  SUBMITTED: "bg-amber-50 text-amber-700",
  GRADED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-orange-50 text-orange-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
};
