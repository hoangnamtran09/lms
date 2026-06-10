import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudyTimer, MIN_PAGES } from "@/hooks/use-study-timer";

// Mock api-client module — dùng vi.hoisted để factory có thể truy cập biến
const { mockApi, mockApiError } = vi.hoisted(() => {
  const mockApi = vi.fn();
  class mockApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { mockApi, mockApiError };
});

vi.mock("@/lib/api-client", () => ({
  api: mockApi,
  ApiError: mockApiError,
}));

// Mock navigator.sendBeacon
const mockSendBeacon = vi.fn(() => true);

beforeAll(() => {
  Object.defineProperty(navigator, "sendBeacon", {
    value: mockSendBeacon,
    writable: true,
    configurable: true,
  });
});

describe("useStudyTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi.mockReset();
    mockSendBeacon.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Trạng thái khởi tạo
  // ---------------------------------------------------------------------------

  it("trả về trạng thái khởi tạo mặc định", () => {
    const { result } = renderHook(() =>
      useStudyTimer(false, new Set(), "lesson-1")
    );

    expect(result.current.sessionId).toBeNull();
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.qualifiedPages.size).toBe(0);
    expect(result.current.chatUnlocked).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Local timer
  // ---------------------------------------------------------------------------

  it("bắt đầu đếm giây khi active", async () => {
    const { result } = renderHook(() =>
      useStudyTimer(true, new Set(), "lesson-1")
    );

    // API start session
    mockApi.mockResolvedValueOnce({ id: "session-1" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(1);
  });

  it("dừng đếm khi active=false", async () => {
    mockApi.mockResolvedValueOnce({ id: "session-1" });

    const { result, rerender } = renderHook(
      ({ active }) => useStudyTimer(active, new Set(), "lesson-1"),
      { initialProps: { active: true } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const before = result.current.elapsedSeconds;
    expect(before).toBeGreaterThan(0);

    rerender({ active: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Không tăng thêm sau khi dừng
    expect(result.current.elapsedSeconds).toBe(before);
  });

  // ---------------------------------------------------------------------------
  // Chat unlocked
  // ---------------------------------------------------------------------------

  it("chatUnlocked = false khi chưa đủ thời gian và trang", () => {
    const { result } = renderHook(() =>
      useStudyTimer(true, new Set(), "lesson-1")
    );

    expect(result.current.chatUnlocked).toBe(false);
  });

  it("chatUnlocked = true khi đủ >=60s và >=3 trang qualified", async () => {
    mockApi.mockResolvedValue({ id: "session-1" });

    // 3 trang visible trong toàn bộ 60+ giây
    const pages = new Set([1, 2, 3]);
    const { result } = renderHook(() =>
      useStudyTimer(true, pages, "lesson-1")
    );

    // Chạy 61 giây với các trang luôn visible
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61 * 1000);
    });

    expect(result.current.elapsedSeconds).toBeGreaterThanOrEqual(60);
    expect(result.current.qualifiedPages.size).toBeGreaterThanOrEqual(MIN_PAGES);
    expect(result.current.chatUnlocked).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // API session management
  // ---------------------------------------------------------------------------

  it("gọi API start session khi active", async () => {
    mockApi.mockResolvedValueOnce({ id: "session-123" });

    renderHook(() => useStudyTimer(true, new Set(), "lesson-1"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockApi).toHaveBeenCalledWith(
      "/api/study-sessions/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ lessonId: "lesson-1" }),
      })
    );
  });

  it("không gọi start session khi không active", () => {
    renderHook(() => useStudyTimer(false, new Set(), "lesson-1"));

    expect(mockApi).not.toHaveBeenCalled();
  });

  it("endSession gọi API end và dừng timer", async () => {
    mockApi.mockResolvedValueOnce({ id: "session-1" });
    mockApi.mockResolvedValueOnce({});

    const { result } = renderHook(() =>
      useStudyTimer(true, new Set(), "lesson-1")
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      await result.current.endSession();
    });

    expect(mockApi).toHaveBeenCalledWith(
      expect.stringContaining("/end"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.current.sessionId).toBeNull();
  });

  it("cancelSession gọi API DELETE và dừng timer", async () => {
    mockApi.mockResolvedValueOnce({ id: "session-1" });
    mockApi.mockResolvedValueOnce({});

    const { result } = renderHook(() =>
      useStudyTimer(true, new Set(), "lesson-1")
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      await result.current.cancelSession();
    });

    expect(mockApi).toHaveBeenCalledWith(
      expect.stringContaining("session-1"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  // ---------------------------------------------------------------------------
  // beforeunload
  // ---------------------------------------------------------------------------

  it("gửi sendBeacon khi beforeunload", async () => {
    mockApi.mockResolvedValueOnce({ id: "session-beacon" });

    renderHook(() => useStudyTimer(true, new Set(), "lesson-beacon"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    // Trigger beforeunload
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    expect(mockSendBeacon).toHaveBeenCalledWith(
      expect.stringContaining("/end"),
      expect.any(Blob)
    );
  });

  // ---------------------------------------------------------------------------
  // Visibility change
  // ---------------------------------------------------------------------------

  it("dừng timer khi tab ẩn, tiếp tục khi hiện lại", async () => {
    mockApi.mockResolvedValue({ id: "session-vis" });

    const { result } = renderHook(() =>
      useStudyTimer(true, new Set(), "lesson-vis")
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const beforeHide = result.current.elapsedSeconds;
    expect(beforeHide).toBeGreaterThan(0);

    // Giả lập tab ẩn
    Object.defineProperty(document, "hidden", {
      value: true,
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Timer không tăng khi ẩn
    expect(result.current.elapsedSeconds).toBe(beforeHide);

    // Giả lập tab hiện lại
    Object.defineProperty(document, "hidden", {
      value: false,
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.elapsedSeconds).toBeGreaterThan(beforeHide);
  });

  // ---------------------------------------------------------------------------
  // Backend unavailable handling
  // ---------------------------------------------------------------------------

  it("ngừng heartbeat khi backend trả về 404 (session mất)", async () => {
    mockApi
      .mockResolvedValueOnce({ id: "session-404" }) // start
      .mockRejectedValueOnce( // heartbeat fails with 404
        Object.assign(new Error("Not Found"), { status: 404, name: "ApiError" })
      );

    renderHook(() => useStudyTimer(true, new Set([1, 2, 3]), "lesson-404"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100); // bootstrap init
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000); // heartbeat fires
    });

    // Chỉ gọi start, heartbeat bị tắt sau 404
    const startCalls = mockApi.mock.calls.filter((c: string[]) =>
      c[0].includes("start")
    );
    expect(startCalls.length).toBe(1);
  });
});
