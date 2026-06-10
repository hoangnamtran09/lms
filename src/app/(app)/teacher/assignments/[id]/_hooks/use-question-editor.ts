"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import type { Question } from "../_types";

interface UseQuestionEditorOptions {
  assignmentId: string;
  questions: Question[];
  onSaved: () => void; // callback để reload data sau khi lưu
}

export function useQuestionEditor({ assignmentId, questions, onSaved }: UseQuestionEditorOptions) {
  const [editingQuestions, setEditingQuestions] = useState(false);
  const [editedQuestions, setEditedQuestions] = useState<Question[]>([]);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = useCallback(() => {
    setEditedQuestions(JSON.parse(JSON.stringify(questions)));
    setEditingQuestions(true);
  }, [questions]);

  const cancelEditing = useCallback(() => {
    setEditedQuestions([]);
    setEditingQuestions(false);
  }, []);

  const updateQuestion = useCallback(
    (index: number, field: string, value: unknown) => {
      setEditedQuestions((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const updateOption = useCallback(
    (qIndex: number, optIndex: number, field: string, value: unknown) => {
      setEditedQuestions((prev) => {
        const next = [...prev];
        const options = [...(next[qIndex].options || [])];
        options[optIndex] = { ...options[optIndex], [field]: value };
        next[qIndex] = { ...next[qIndex], options };
        return next;
      });
    },
    []
  );

  const addOption = useCallback((qIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = [
        ...(next[qIndex].options || []),
        { text: "", isCorrect: false },
      ];
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  }, []);

  const removeOption = useCallback((qIndex: number, optIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = (next[qIndex].options || []).filter(
        (_, i) => i !== optIndex
      );
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  }, []);

  const setCorrectOption = useCallback((qIndex: number, optIndex: number) => {
    setEditedQuestions((prev) => {
      const next = [...prev];
      const options = (next[qIndex].options || []).map((o, i) => ({
        ...o,
        isCorrect: i === optIndex,
      }));
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    setSavingQuestions(true);
    setError(null);
    try {
      await api(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ questions: JSON.stringify(editedQuestions) }),
      });
      setEditingQuestions(false);
      setEditedQuestions([]);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Lỗi lưu câu hỏi");
    } finally {
      setSavingQuestions(false);
    }
  }, [assignmentId, editedQuestions, onSaved]);

  return {
    editingQuestions,
    editedQuestions,
    savingQuestions,
    error,
    startEditing,
    cancelEditing,
    updateQuestion,
    updateOption,
    addOption,
    removeOption,
    setCorrectOption,
    save,
  };
}
