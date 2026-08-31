import { describe, expect, it } from "vitest";

import {
  aiItemRequestSchema,
  codeExplanationSchema,
  itemSummarySchema,
  MAX_SUGGESTED_TAGS,
  optimizedPromptSchema,
  suggestedTagsSchema,
} from "@/lib/validations/ai";
import {
  DESCRIPTION_MAX_LENGTH,
  TAG_MAX_LENGTH,
} from "@/lib/validations/item";

describe("aiItemRequestSchema", () => {
  it("takes an item id", () => {
    expect(aiItemRequestSchema.safeParse({ itemId: "item-1" }).success).toBe(
      true,
    );
  });

  it("refuses a missing or blank id", () => {
    expect(aiItemRequestSchema.safeParse({}).success).toBe(false);
    expect(aiItemRequestSchema.safeParse({ itemId: "   " }).success).toBe(false);
  });

  /**
   * The load-bearing property: an action takes an id and re-reads the item
   * with the session's user in the `where`, so a caller can neither have the
   * model work on someone else's text nor inflate the bill by posting their
   * own megabyte. Content arriving in the request is dropped, not honoured.
   */
  it("strips content a caller tries to send alongside the id", () => {
    const result = aiItemRequestSchema.safeParse({
      itemId: "item-1",
      content: "x".repeat(1_000_000),
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ itemId: "item-1" });
    expect(result.data).not.toHaveProperty("content");
  });
});

describe("suggestedTagsSchema", () => {
  it("takes a short list", () => {
    const result = suggestedTagsSchema.safeParse({ tags: ["react", "hooks"] });

    expect(result.success).toBe(true);
  });

  it("accepts exactly the cap", () => {
    const tags = Array.from({ length: MAX_SUGGESTED_TAGS }, (_, i) => `tag-${i}`);

    expect(suggestedTagsSchema.safeParse({ tags }).success).toBe(true);
  });

  /**
   * Enforced rather than trimmed. A model returning forty tags has not done
   * the task, and silently keeping the first eight would hide that from us.
   */
  it("fails on 40 tags rather than silently keeping 8", () => {
    const tags = Array.from({ length: 40 }, (_, i) => `tag-${i}`);
    const result = suggestedTagsSchema.safeParse({ tags });

    expect(result.success).toBe(false);
  });

  it("holds each tag to the same length the item schema stores", () => {
    const ok = { tags: ["x".repeat(TAG_MAX_LENGTH)] };
    const tooLong = { tags: ["x".repeat(TAG_MAX_LENGTH + 1)] };

    expect(suggestedTagsSchema.safeParse(ok).success).toBe(true);
    // A suggestion that could not be stored should never be offered.
    expect(suggestedTagsSchema.safeParse(tooLong).success).toBe(false);
  });

  it("refuses an empty tag", () => {
    expect(suggestedTagsSchema.safeParse({ tags: [""] }).success).toBe(false);
    expect(suggestedTagsSchema.safeParse({ tags: ["   "] }).success).toBe(false);
  });
});

describe("itemSummarySchema", () => {
  it("caps at what the description column takes", () => {
    const ok = { summary: "x".repeat(DESCRIPTION_MAX_LENGTH) };
    const tooLong = { summary: "x".repeat(DESCRIPTION_MAX_LENGTH + 1) };

    expect(itemSummarySchema.safeParse(ok).success).toBe(true);
    expect(itemSummarySchema.safeParse(tooLong).success).toBe(false);
  });

  it("refuses an empty summary", () => {
    expect(itemSummarySchema.safeParse({ summary: "  " }).success).toBe(false);
  });
});

describe("codeExplanationSchema", () => {
  it("takes an explanation and refuses an empty one", () => {
    expect(
      codeExplanationSchema.safeParse({ explanation: "It debounces." }).success,
    ).toBe(true);
    expect(codeExplanationSchema.safeParse({ explanation: "" }).success).toBe(
      false,
    );
  });

  it("is bounded, so one answer cannot be unbounded output", () => {
    const result = codeExplanationSchema.safeParse({
      explanation: "x".repeat(100_000),
    });

    expect(result.success).toBe(false);
  });
});

describe("optimizedPromptSchema", () => {
  it("takes a rewrite and its note", () => {
    const result = optimizedPromptSchema.safeParse({
      prompt: "Summarize the text below in one sentence.",
      note: "Made the output format explicit.",
    });

    expect(result.success).toBe(true);
  });

  it("allows an empty note but not an empty prompt", () => {
    expect(
      optimizedPromptSchema.safeParse({ prompt: "Do the thing.", note: "" })
        .success,
    ).toBe(true);
    expect(
      optimizedPromptSchema.safeParse({ prompt: "", note: "x" }).success,
    ).toBe(false);
  });
});
