"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

function renderMath(text: string, displayMode: boolean): string {
  try {
    return katex.renderToString(text, {
      displayMode,
      throwOnError: false,
      trust: true,
    });
  } catch {
    return text;
  }
}

export function MathText({ text }: { text: string }) {
  const html = useMemo(() => {
    // Split by $$...$$ (display) and $...$ (inline)
    const parts: string[] = [];

    // Handle display math $$...$$
    const displayRegex = /\$\$([\s\S]*?)\$\$/g;
    const displayMatches: Array<{ index: number; text: string; math: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = displayRegex.exec(text)) !== null) {
      displayMatches.push({ index: m.index, text: m[0], math: m[1] });
    }

    if (displayMatches.length > 0) {
      let last = 0;
      for (const dm of displayMatches) {
        if (dm.index > last) parts.push(escapeHtml(text.slice(last, dm.index)));
        parts.push(renderMath(dm.math, true));
        last = dm.index + dm.text.length;
      }
      if (last < text.length) parts.push(escapeHtml(text.slice(last)));
    } else {
      // Handle inline math $...$ (but not $$)
      const inlineRegex = /(?<!\$)\$(?!\$)([^$]+)\$(?!\$)/g;
      let last = 0;
      let im: RegExpExecArray | null;
      while ((im = inlineRegex.exec(text)) !== null) {
        if (im.index > last) parts.push(escapeHtml(text.slice(last, im.index)));
        parts.push(renderMath(im[1], false));
        last = im.index + im[0].length;
      }
      if (last < text.length) parts.push(escapeHtml(text.slice(last)));
    }

    return parts.join("");
  }, [text]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
