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
  lastQuizResult: boolean | null;
  handleQuizAnswered: (isCorrect: boolean) => void;
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
  const [lastQuizResult, setLastQuizResult] = useState<boolean | null>(null);

  const handleQuizAnswered = (isCorrect: boolean) => {
    setLastQuizResult(isCorrect);
    setActiveQuiz(null);
  };

  const clearLastQuizResult = () => setLastQuizResult(null);

  return (
    <ActiveQuizContext.Provider value={{ activeQuiz, setActiveQuiz, lastQuizResult, handleQuizAnswered, clearLastQuizResult }}>
      {children}
    </ActiveQuizContext.Provider>
  );
}

export function useActiveQuiz() {
  return useContext(ActiveQuizContext);
}
