"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface QuizData {
  question: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
}

interface ActiveQuizContextValue {
  activeQuiz: QuizData | null;
  setActiveQuiz: (quiz: QuizData | null) => void;
}

const ActiveQuizContext = createContext<ActiveQuizContextValue>({
  activeQuiz: null,
  setActiveQuiz: () => {},
});

export function ActiveQuizProvider({ children }: { children: ReactNode }) {
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  return (
    <ActiveQuizContext.Provider value={{ activeQuiz, setActiveQuiz }}>
      {children}
    </ActiveQuizContext.Provider>
  );
}

export function useActiveQuiz() {
  return useContext(ActiveQuizContext);
}
