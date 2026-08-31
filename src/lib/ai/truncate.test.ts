import { describe, expect, it } from "vitest";

import {
  AI_CHARACTER_BUDGET,
  TRUNCATION_MARKER,
  truncateForAi,
} from "@/lib/ai/truncate";

describe("truncateForAi", () => {
  it("returns short content untouched, with no marker", () => {
    const content = "const x = 1;";

    expect(truncateForAi(content)).toBe(content);
    expect(truncateForAi(content)).not.toContain(TRUNCATION_MARKER);
  });

  it("does not truncate content of exactly the budget", () => {
    // The `>` boundary: a complete artifact that happens to fill the budget
    // must not be marked as cut, which would be a lie about it.
    const content = "x".repeat(AI_CHARACTER_BUDGET);

    expect(truncateForAi(content)).toBe(content);
  });

  it("truncates one character over the budget", () => {
    const content = "x".repeat(AI_CHARACTER_BUDGET + 1);
    const result = truncateForAi(content);

    expect(result).toContain(TRUNCATION_MARKER);
    expect(result).toBe("x".repeat(AI_CHARACTER_BUDGET) + TRUNCATION_MARKER);
  });

  /**
   * The decision worth pinning: a file's imports and top-level structure are
   * where an explanation starts, so a window from the middle is the least
   * useful slice available.
   */
  it("takes the head, not the middle or the tail", () => {
    const content = "FIRST" + "x".repeat(100) + "LAST";
    const result = truncateForAi(content, 20);

    expect(result.startsWith("FIRST")).toBe(true);
    expect(result).not.toContain("LAST");
  });

  it("cuts to the budget, so the content sent is bounded", () => {
    const result = truncateForAi("x".repeat(5_000), 100);

    expect(result.length - TRUNCATION_MARKER.length).toBe(100);
  });

  it("handles an empty string", () => {
    expect(truncateForAi("")).toBe("");
  });
});
