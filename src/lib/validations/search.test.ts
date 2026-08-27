import { describe, expect, it } from "vitest";

import { MIN_QUERY_LENGTH, searchQuerySchema } from "@/lib/validations/search";

describe("searchQuerySchema", () => {
  it("trims the query", () => {
    expect(searchQuerySchema.parse("  react  ")).toBe("react");
  });

  /**
   * The rule the trim exists for: a query of nothing but whitespace is too
   * short, not a search for a space. Without the trim running first it would be
   * long enough and every row would match.
   */
  it("rejects a whitespace-only query", () => {
    expect(searchQuerySchema.safeParse("     ").success).toBe(false);
  });

  it("rejects a query shorter than the minimum", () => {
    expect(searchQuerySchema.safeParse("a".repeat(MIN_QUERY_LENGTH - 1)).success)
      .toBe(false);
    expect(
      searchQuerySchema.safeParse("a".repeat(MIN_QUERY_LENGTH)).success,
    ).toBe(true);
  });

  // Trimmed before the length check on this side too, so trailing spaces cannot
  // push a legitimate query over the cap.
  it("caps the query length, counting after the trim", () => {
    expect(searchQuerySchema.safeParse("a".repeat(100)).success).toBe(true);
    expect(searchQuerySchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(
      searchQuerySchema.safeParse(`${"a".repeat(100)}    `).success,
    ).toBe(true);
  });
});
