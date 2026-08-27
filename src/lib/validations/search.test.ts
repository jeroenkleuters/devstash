import { describe, expect, it } from "vitest";

import { MIN_QUERY_LENGTH, searchQuerySchema } from "@/lib/validations/search";

describe("searchQuerySchema", () => {
  it("trims the query", () => {
    expect(searchQuerySchema.parse("  react  ")).toBe("react");
  });

  /**
   * The rule the trim exists for: a query of nothing but whitespace comes out
   * empty, so the route browses rather than searching for a space.
   */
  it("reduces a whitespace-only query to nothing", () => {
    expect(searchQuerySchema.parse("     ")).toBe("");
  });

  /**
   * Deliberately has no minimum. A short query is a request to browse, not a
   * bad request — the route compares against `MIN_QUERY_LENGTH` to decide
   * which, and the schema rejecting one here would make that a 400 instead.
   */
  it("accepts a query shorter than the search floor", () => {
    for (let length = 0; length < MIN_QUERY_LENGTH; length++) {
      expect(searchQuerySchema.safeParse("a".repeat(length)).success).toBe(true);
    }
  });

  // Trimmed before the length check, so trailing spaces cannot push a
  // legitimate query over the cap.
  it("caps the query length, counting after the trim", () => {
    expect(searchQuerySchema.safeParse("a".repeat(100)).success).toBe(true);
    expect(searchQuerySchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(searchQuerySchema.safeParse(`${"a".repeat(100)}    `).success).toBe(
      true,
    );
  });
});
