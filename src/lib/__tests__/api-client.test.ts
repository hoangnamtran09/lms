import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, apiStream, uploadFile, fetchList, ApiError, API_BASE } from "@/lib/api-client";

// Mock supabase client module
const mockGetSession = vi.fn(() =>
  Promise.resolve({ data: { session: null as { access_token: string } | null } })
);
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
    },
  })),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location for 401 tests
const mockLocation = {
  href: "",
  pathname: "",
  assign: vi.fn(),
};
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});

describe("ApiError", () => {
  it("tạo instance với message và status", () => {
    const err = new ApiError("Not Found", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Not Found");
    expect(err.status).toBe(404);
  });
});

describe("api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = "/some-page";
    mockLocation.href = "";
  });

  it("gọi fetch với URL đúng và trả về JSON", async () => {
    const data = { id: 1, name: "Test" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    });

    const result = await api("/api/test");
    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/test`,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("gửi kèm Authorization header khi có Supabase session", async () => {
    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: "test-token" } },
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api("/api/test");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-token");
  });

  it("ném ApiError khi response không ok", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    let caught: ApiError | null = null;
    try {
      await api("/api/test");
    } catch (e) {
      caught = e as ApiError;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught!.message).toBe("Internal Server Error");
    expect(caught!.status).toBe(500);
  });

  it("xử lý 401 bằng cách sign out và redirect", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(api("/api/test")).rejects.toThrow("Unauthorized");
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockLocation.href).toBe("/login");
  });

  it("không redirect khi 401 xảy ra trên trang login", async () => {
    mockLocation.pathname = "/login";
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(api("/api/test")).rejects.toThrow("Unauthorized");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("merge custom headers với auth headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    await api("/api/test", {
      method: "POST",
      headers: { "X-Custom": "value" },
      body: JSON.stringify({ key: "val" }),
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["X-Custom"]).toBe("value");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

describe("fetchList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("trả về mảng khi response là mảng", async () => {
    const list = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(list),
    });

    const result = await fetchList("/api/items");
    expect(result).toEqual(list);
  });

  it("unwrap { data: [...] } pattern", async () => {
    const list = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: list }),
    });

    const result = await fetchList("/api/items");
    expect(result).toEqual(list);
  });
});

describe("uploadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upload file với FormData và trả về url + key", async () => {
    const response = { url: "https://example.com/file.pdf", key: "uploads/file.pdf" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    });

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const result = await uploadFile("/api/media/upload", file);

    expect(result).toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE}/api/media/upload`,
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });

  it("ném ApiError khi upload thất bại", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      text: () => Promise.resolve("File too large"),
    });

    const file = new File(["content"], "test.pdf");
    await expect(uploadFile("/api/media/upload", file)).rejects.toThrow(ApiError);
  });
});

describe("apiStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockReader(chunks: string[]) {
    let index = 0;
    const encoder = new TextEncoder();
    return {
      read: () => {
        if (index >= chunks.length) {
          return Promise.resolve({ done: true, value: undefined });
        }
        return Promise.resolve({
          done: false,
          value: encoder.encode(chunks[index++]),
        });
      },
    };
  }

  it("parse SSE chunk và gọi onChunk cho mỗi delta", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => createMockReader([
          'data: {"delta":"Xin "}\n',
          'data: {"delta":"chào"}\n',
          "data: [DONE]\n",
        ]),
      },
    });

    await apiStream("/api/ai/chat", { message: "hi" }, onChunk, onDone, onError);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, "Xin ");
    expect(onChunk).toHaveBeenNthCalledWith(2, "chào");
    expect(onDone).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("gọi onQuiz khi parsed.quiz tồn tại", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();
    const onQuiz = vi.fn();
    const quizData = {
      question: "2+2=?",
      options: [{ text: "4" }],
      explanation: "Phép cộng cơ bản",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () =>
          createMockReader([
            `data: ${JSON.stringify({ quiz: quizData })}\n`,
            "data: [DONE]\n",
          ]),
      },
    });

    await apiStream("/api/ai/chat", { message: "quiz" }, onChunk, onDone, onError, onQuiz);

    expect(onQuiz).toHaveBeenCalledWith(quizData);
    expect(onDone).toHaveBeenCalled();
  });

  it("gọi onError khi server trả về lỗi", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await apiStream("/api/ai/chat", { message: "hi" }, onChunk, onDone, onError);

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("gọi onDone khi stream kết thúc không có [DONE]", async () => {
    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => createMockReader(['data: {"delta":"test"}\n']),
      },
    });

    await apiStream("/api/ai/chat", { message: "hi" }, onChunk, onDone, onError);

    expect(onDone).toHaveBeenCalled();
  });
});
