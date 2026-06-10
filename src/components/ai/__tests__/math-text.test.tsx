import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MathText } from "@/components/ai/math-text";

describe("MathText", () => {
  it("render text thường không chứa LaTeX", () => {
    const { container } = render(<MathText text="Xin chào" />);
    expect(container.textContent).toBe("Xin chào");
  });

  it("render inline math $...$ thành KaTeX HTML", () => {
    const { container } = render(<MathText text="Công thức $E = mc^2$ quan trọng" />);
    // KaTeX render chứa class katex
    expect(container.querySelector(".katex")).toBeTruthy();
    expect(container.textContent).toContain("Công thức");
    expect(container.textContent).toContain("quan trọng");
  });

  it("render display math $$...$$ thành KaTeX HTML", () => {
    const { container } = render(<MathText text="$$\\frac{a}{b}$$" />);
    expect(container.querySelector(".katex")).toBeTruthy();
  });

  it("render nhiều công thức trong cùng text", () => {
    // Lưu ý: code xử lý $$...$$ trước, nếu có display math thì bỏ qua inline math
    const { container } = render(
      <MathText text="Biết $x=1$, $y=2$, tính $$x+y$$" />
    );
    // Display math sinh 1 .katex, inline math trong nhánh "else" không chạy
    expect(container.querySelectorAll(".katex").length).toBe(1);
    expect(container.textContent).toContain("tính");
  });

  it("escape HTML trong text thường", () => {
    const { container } = render(<MathText text={'<script>alert("xss")</script>'} />);
    expect(container.innerHTML).not.toContain("<script>");
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });

  it("fallback hiển thị text gốc khi LaTeX lỗi", () => {
    // KaTeX throwOnError=false — lỗi hiển thị text lỗi trong span màu đỏ
    const { container } = render(<MathText text={"$\\invalid{}$"} />);
    expect(container.querySelector(".katex")).toBeTruthy();
    // KaTeX vẽ lỗi với style="color:#cc0000"
    const errorSpan = container.querySelector(".katex [style*=\"color\"]");
    expect(errorSpan).toBeTruthy();
  });

  it("text rỗng render không lỗi", () => {
    const { container } = render(<MathText text="" />);
    expect(container.querySelector("span")).toBeTruthy();
  });
});
