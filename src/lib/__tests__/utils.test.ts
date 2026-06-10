import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("trả về chuỗi rỗng khi không có input", () => {
    expect(cn()).toBe("");
  });

  it("nối các class đơn giản", () => {
    expect(cn("bg-red-500", "text-white")).toBe("bg-red-500 text-white");
  });

  it("merge class tailwind xung đột (cái sau thắng)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("bỏ qua falsy values (false, null, undefined)", () => {
    expect(cn("base", false && "hidden", null, undefined, "extra")).toBe("base extra");
  });

  it("xử lý conditional class với object", () => {
    const result = cn("base", { active: true, disabled: false });
    expect(result).toContain("base");
    expect(result).toContain("active");
    expect(result).not.toContain("disabled");
  });

  it("merge đúng với nhiều class xung đột", () => {
    expect(cn("text-sm text-red-500", "text-lg text-blue-500")).toBe(
      "text-lg text-blue-500"
    );
  });

  it("xử lý mảng class", () => {
    expect(cn(["px-2", "py-1"], "mt-4")).toBe("px-2 py-1 mt-4");
  });

  it("xử lý class dạng string template", () => {
    const isActive = true;
    expect(cn("base", isActive ? "active" : "inactive")).toBe("base active");
  });
});
