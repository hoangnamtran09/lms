import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveQuiz } from "@/components/ai/interactive-quiz";

// Mock api-client
const { mockApi } = vi.hoisted(() => ({ mockApi: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  api: mockApi,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const baseQuiz = {
  question: "Kết quả của $2+2$ là?",
  options: [{ text: "3" }, { text: "4" }, { text: "5" }, { text: "6" }],
  explanation: "2 + 2 = 4 là phép cộng cơ bản",
};

const baseProps = {
  quiz: baseQuiz,
  lessonId: "lesson-1",
  sessionId: null as string | null,
};

function renderQuiz(props = {}) {
  return render(<InteractiveQuiz {...baseProps} {...props} />);
}

describe("InteractiveQuiz", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  it("hiển thị câu hỏi và các lựa chọn", () => {
    renderQuiz();
    // Câu hỏi hiển thị qua MathText
    expect(screen.getByText(/2\+2/)).toBeTruthy();
    // Các option text
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });

  it("các nút lựa chọn ở trạng thái enabled khi chưa trả lời", () => {
    renderQuiz();
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Tương tác
  // ---------------------------------------------------------------------------

  it("gọi API validate khi chọn đáp án", async () => {
    mockApi.mockResolvedValueOnce({
      isCorrect: true,
      explanation: "Chính xác!",
    });
    renderQuiz();

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // Chọn "4"

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith(
        "/api/ai/validate-quiz",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            lessonId: "lesson-1",
            subjectId: undefined,
            sessionId: "",
            question: baseQuiz.question,
            selectedIndex: 1,
          }),
        })
      );
    });
  });

  it("hiển thị trạng thái correct khi trả lời đúng", async () => {
    mockApi.mockResolvedValueOnce({
      isCorrect: true,
      explanation: "Chính xác!",
    });

    renderQuiz();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // Chọn "4"

    await waitFor(() => {
      // Có 2 phần tử "Chính xác!": heading + explanation (qua MathText)
      const elements = screen.getAllByText("Chính xác!");
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("hiển thị trạng thái incorrect khi trả lời sai", async () => {
    mockApi.mockResolvedValueOnce({
      isCorrect: false,
      explanation: "Sai rồi!",
    });

    renderQuiz();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // Chọn "3"

    await waitFor(() => {
      expect(screen.getByText("Chưa đúng")).toBeTruthy();
    });
  });

  it("gọi onAnswered callback sau khi validate", async () => {
    const onAnswered = vi.fn();
    mockApi.mockResolvedValueOnce({
      isCorrect: true,
      explanation: "OK",
    });

    renderQuiz({ onAnswered });
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]); // Chọn "5"

    await waitFor(() => {
      expect(onAnswered).toHaveBeenCalledWith(true);
    });
  });

  it("không cho phép chọn lại sau khi đã trả lời", async () => {
    mockApi.mockResolvedValueOnce({
      isCorrect: false,
      explanation: "Sai!",
    });

    renderQuiz();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // Chọn "3"

    await waitFor(() => {
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  it("xử lý lỗi API bằng cách hiển thị incorrect", async () => {
    mockApi.mockRejectedValueOnce(new Error("Network error"));

    renderQuiz();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[2]); // Chọn "5"

    // Khi lỗi, state → "incorrect", explanation fallback = quiz.explanation
    await waitFor(() => {
      expect(screen.getByText("Chưa đúng")).toBeTruthy();
    });
  });
});
