"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface QuizData {
  question: string;
  options: { text: string }[];
  explanation: string;
}

export interface QuizResult {
  isCorrect: boolean;
  question: string;
}

interface ActiveQuizContextValue {
  activeQuiz: QuizData | null;
  setActiveQuiz: (quiz: QuizData | null) => void;
  lastQuizResult: QuizResult | null;
  handleQuizAnswered: (result: QuizResult) => void;
  clearLastQuizResult: () => void;
}

const ActiveQuizContext = createContext<ActiveQuizContextValue>({
  activeQuiz: null,
  setActiveQuiz: () => {},
  lastQuizResult: null,
  handleQuizAnswered: () => {},
  clearLastQuizResult: () => {},
});

export function ActiveQuizProvider({ children }: { children: ReactNode }) {
  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [lastQuizResult, setLastQuizResult] = useState<QuizResult | null>(null);

  const handleQuizAnswered = useCallback((result: QuizResult) => {
    setLastQuizResult(result);
    setActiveQuiz(null);
  }, []);

  const clearLastQuizResult = useCallback(() => setLastQuizResult(null), []);

  return (
    <ActiveQuizContext.Provider value={{ activeQuiz, setActiveQuiz, lastQuizResult, handleQuizAnswered, clearLastQuizResult }}>
      {children}
    </ActiveQuizContext.Provider>
  );
}

export function useActiveQuiz() {
  return useContext(ActiveQuizContext);
}
