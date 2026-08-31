import { describe, expect, it } from "vitest";

import {
  aiItemRequestSchema,
  codeExplanationSchema,
  itemSummarySchema,
  MAX_SUGGESTED_TAGS,
  MAX_OPTIMIZER_NOTES,
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

  /**
   * The destination is the Description field, so the cap is that field's and
   * is imported rather than restated — a summary the model was allowed to
   * return and the form then refused would look like a bug and waste a call.
   * The literal here is the spec's own example, and it is only meaningful
   * because the constant really is 500.
   */
  it("refuses a 600-character summary, the cap being the field's own", () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(500);
    expect(itemSummarySchema.safeParse({ summary: "x".repeat(600) }).success).toBe(
      false,
    );
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

  /**
   * The cap is 4,000 characters — a decision rather than an accident. Nothing
   * stores an explanation, so the cap is about the bill and the reading rather
   * than a column, and a long-form essay is not what someone opening a snippet
   * they wrote six months ago wants. 20,000 is the length the spec names as a
   * refusal; 100,000 is what a runaway answer looks like.
   */
  it("is bounded, so one answer cannot be unbounded output", () => {
    expect(
      codeExplanationSchema.safeParse({ explanation: "x".repeat(20_000) })
        .success,
    ).toBe(false);
    expect(
      codeExplanationSchema.safeParse({ explanation: "x".repeat(100_000) })
        .success,
    ).toBe(false);
  });
});

describe("optimizedPromptSchema", () => {
  it("takes a rewrite and its notes", () => {
    const result = optimizedPromptSchema.safeParse({
      optimized: "Summarize the text below in one sentence.",
      notes: ["Made the output format explicit.", "Kept the length limit."],
    });

    expect(result.success).toBe(true);
  });

  it("allows no notes at all, but not an empty rewrite", () => {
    expect(
      optimizedPromptSchema.safeParse({ optimized: "Do the thing.", notes: [] })
        .success,
    ).toBe(true);
    expect(
      optimizedPromptSchema.safeParse({ optimized: "", notes: ["x"] }).success,
    ).toBe(false);
  });

  /**
   * The cap is enforced rather than trimmed, the same call `suggestedTagsSchema`
   * makes: a model returning ten notes has not done the task, and silently
   * keeping the first five would hide that. A list longer than the change it
   * describes is its own problem.
   */
  it("caps the notes at five", () => {
    const note = "Made the output format explicit.";

    expect(
      optimizedPromptSchema.safeParse({
        optimized: "Do the thing.",
        notes: Array.from({ length: MAX_OPTIMIZER_NOTES }, () => note),
      }).success,
    ).toBe(true);
    expect(
      optimizedPromptSchema.safeParse({
        optimized: "Do the thing.",
        notes: Array.from({ length: MAX_OPTIMIZER_NOTES + 1 }, () => note),
      }).success,
    ).toBe(false);
  });

  /** A note is a sentence about one change, not a second essay. */
  it("refuses a note that is not a sentence", () => {
    expect(
      optimizedPromptSchema.safeParse({
        optimized: "Do the thing.",
        notes: ["x".repeat(1_000)],
      }).success,
    ).toBe(false);
  });

  /**
   * `content` is `@db.Text` and uncapped, so this bound exists purely to stop
   * one call producing unbounded — and unbounded-cost — output.
   */
  it("is bounded, so one rewrite cannot be unbounded output", () => {
    expect(
      optimizedPromptSchema.safeParse({
        optimized: "x".repeat(20_000),
        notes: [],
      }).success,
    ).toBe(false);
  });
});
