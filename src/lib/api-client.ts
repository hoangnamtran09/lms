import { createClient } from "@/lib/supabase/client";

const API_BASE = "";

export async function fetchList<T>(path: string): Promise<T[]> {
  const res = await api<T[] | { data: T[] }>(path);
  return Array.isArray(res) ? res : res.data;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Supabase not initialized (SSR), skip Bearer token
  }
  return headers;
}

async function handle401() {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
  window.location.href = "/login";
}

export async function uploadFile(path: string, file: File, extraFields?: Record<string, string>): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append("file", file);
  if (extraFields) {
    for (const [k, v] of Object.entries(extraFields)) {
      formData.append(k, v);
    }
  }
  const headers: Record<string, string> = {};
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // ignore
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (res.status === 401) {
    await handle401();
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body, res.status);
  }

  return res.json();
}

const REQUEST_TIMEOUT = 30000;

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal: controller.signal,
    headers: {
      ...authHeaders,
      ...options?.headers,
    },
  });
  clearTimeout(timeoutId);

  if (res.status === 401) {
    await handle401();
    throw new ApiError("Unauthorized", 401);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body, res.status);
  }

  return res.json();
}

export async function apiStream(
  path: string,
  body: unknown,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: Error) => void
): Promise<void> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(body),
    });

    if (res.status === 401 && typeof window !== "undefined") {
      await handle401();
      return;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) return;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.delta) {
          onChunk(parsed.delta);
        } else if (parsed.error) {
          onError(new Error(parsed.error));
        }
      } catch {
        // ignore unparseable lines
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          processLine(buffer.trim());
        }
        onDone();
        break;
      }
      const text = decoder.decode(value, { stream: true });
      buffer += text;
      const lines = buffer.split("\n");
      // The last element may be a partial line; keep it in buffer
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}
