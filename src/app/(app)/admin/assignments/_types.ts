// Types & constants dùng chung cho admin/assignments.

export type CreationMode = "lesson" | "weakness" | "manual";

export interface AssignmentRow {
  id: string;
  title: string;
  classId: string;
  maxScore: number;
  dueDate: string | null;
  submissionCount: number;
  createdAt: string;
  studentIds?: string;
}

export interface StudentBrief {
  id: string;
  supabaseId: string;
  fullName: string;
  username: string;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  expectedAnswer?: string;
  score?: number;
  type?: string;
  difficulty?: string;
  options?: { text: string; isCorrect: boolean }[];
  explanation?: string;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Course {
  id: string;
  title: string;
  subjectId: string;
  sortOrder: number;
}

export interface Lesson {
  id: string;
  title: string;
  courseId: string;
  sortOrder: number;
}

export const difficultyLabels: Record<string, string> = {
  nhan_biet: "Nhận biết",
  thong_hieu: "Thông hiểu",
  van_dung: "Vận dụng",
};

export interface ClassItem {
  id: string;
  name: string;
}

export interface WeaknessTopic {
  topic: string;
  totalErrors: number;
  studentCount: number;
  studentIds: string[];
}

export const difficultyColors: Record<string, string> = {
  nhan_biet: "bg-emerald-100 text-emerald-700 border-emerald-200",
  thong_hieu: "bg-blue-100 text-blue-700 border-blue-200",
  van_dung: "bg-orange-100 text-orange-700 border-orange-200",
};
