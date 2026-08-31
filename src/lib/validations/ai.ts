import { z } from "zod";

import {
  DESCRIPTION_MAX_LENGTH,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "@/lib/validations/item";

/**
 * The request and response schemas for the AI features, in one file
 * deliberately.
 *
 * The response schema is what `zodTextFormat` constrains the model to **and**
 * what the wrapper validates the parse against. The model is a remote service
 * returning JSON, so its answer is untrusted input like any other — a cap here
 * is both a cap the model is told about and a cap the server enforces, which is
 * the doubled shape `uploadPreferences` already uses.
 */

/**
 * What every AI action takes: an item id, and nothing else.
 *
 * The id rather than the content is the load-bearing part. The action re-reads
 * the item with the session's user id in the `where`, so a caller cannot have
 * the model work on text they do not own, and cannot inflate the bill by
 * posting a megabyte of their own. Zod strips unknown keys, so a request that
 * also carries `content` simply loses it.
 */
export const aiItemRequestSchema = z.object({
  itemId: z.string().trim().min(1, "Choose an item."),
});

export type AiItemRequest = z.infer<typeof aiItemRequestSchema>;

/**
 * The explain request, which alone can ask for a *fresh* answer.
 *
 * `regenerate` skips the **cache read** and nothing else: the call still runs
 * both hourly windows and the spend cap, because a regenerate is a real paid
 * call. It defaults to false, so a caller cannot spend money by omission.
 */
export const explainRequestSchema = aiItemRequestSchema.extend({
  regenerate: z.boolean().default(false),
});

/**
 * How much of a draft a request may carry.
 *
 * Generous — five times the truncation budget — because a real snippet being
 * written can be long and refusing it would be worse than trimming it. What
 * this stops is a multi-megabyte body: the payload is bounded before anything
 * reads it, and `truncateForAi` then bounds what is actually sent.
 */
const DRAFT_MAX_LENGTH = 120_000;

/** What a draft may claim it already carries, matching the item tag ceiling. */
const MAX_TAGS_SENT = 20;

/**
 * What an item being *written* sends, since it has no row to be read from.
 *
 * This is the one place content crosses the wire rather than being read back
 * from the caller's own rows, and it exists because the create dialog is the
 * moment someone most wants tags. The trade is deliberate and narrow: it is
 * behind the identical preamble as the id path — Pro only, both rate limits,
 * the spend cap — so what it can cost is bounded by those rather than by where
 * the text came from. Ownership scoping is not weakened, because there is no
 * stored row involved to scope to.
 *
 * A draft with neither a title nor content is refused: there is nothing to
 * suggest from, and a call that can only disappoint should not be billed.
 */
export const aiDraftRequestSchema = z
  .object({
    title: z.string().trim().max(TITLE_MAX_LENGTH).default(""),
    description: z.string().trim().max(DESCRIPTION_MAX_LENGTH).default(""),
    content: z.string().max(DRAFT_MAX_LENGTH).default(""),
    tags: z.array(z.string().max(TAG_MAX_LENGTH)).max(MAX_TAGS_SENT).default([]),
  })
  .refine((draft) => draft.title !== "" || draft.content.trim() !== "", {
    error: "Add a title or some content first.",
  });

export type AiDraftRequest = z.infer<typeof aiDraftRequestSchema>;

/** At most 8, because an output cap is also an output-token cap. */
export const MAX_SUGGESTED_TAGS = 8;

/**
 * The tags the model may suggest.
 *
 * The cap is enforced rather than trimmed: a model returning forty tags has not
 * done the task, and silently keeping the first eight would hide that. Each tag
 * is held to the same `TAG_MAX_LENGTH` the item schema uses, so a suggestion
 * that cannot be stored is never offered.
 */
export const suggestedTagsSchema = z.object({
  tags: z
    .array(z.string().trim().min(1).max(TAG_MAX_LENGTH))
    .max(MAX_SUGGESTED_TAGS),
});

export type SuggestedTags = z.infer<typeof suggestedTagsSchema>;

/**
 * The summary, capped at what the description column will actually take — the
 * suggestion goes into that field, so a longer one could not be accepted.
 */
export const itemSummarySchema = z.object({
  summary: z.string().trim().min(1).max(DESCRIPTION_MAX_LENGTH),
});

/**
 * Named `SuggestedSummary` rather than `ItemSummary`, which is already the row
 * summary `@/lib/db/items` exports and passes around ten components. Two
 * unrelated types under one name is legal and confusing, and this is the one
 * with no consumers yet, so it is the one that moves.
 */
export type SuggestedSummary = z.infer<typeof itemSummarySchema>;

/**
 * An explanation is read rather than stored, so its cap is about the bill and
 * the reading rather than about a column.
 */
const EXPLANATION_MAX_LENGTH = 4_000;

export const codeExplanationSchema = z.object({
  explanation: z.string().trim().min(1).max(EXPLANATION_MAX_LENGTH),
});

export type CodeExplanation = z.infer<typeof codeExplanationSchema>;

/**
 * The rewritten prompt, and the short list of what changed.
 *
 * `optimized` is held to what `content` can hold in practice rather than to a
 * column limit — `content` is `@db.Text` and has none — so this cap exists
 * purely to bound cost.
 *
 * **The notes are not decoration.** They are what makes the rewrite something
 * a person can weigh rather than a black box, and they cost a handful of
 * output tokens. Five of them, because a list longer than the change it
 * describes is its own problem; each is held to a sentence, loosely enough
 * that a slightly wordy model does not fail the whole call — the SDK's parse
 * throws on a violation, so an over-tight cap here costs the answer entirely.
 */
const OPTIMIZED_PROMPT_MAX_LENGTH = 8_000;
const OPTIMIZER_NOTE_MAX_LENGTH = 300;
export const MAX_OPTIMIZER_NOTES = 5;

export const optimizedPromptSchema = z.object({
  optimized: z.string().trim().min(1).max(OPTIMIZED_PROMPT_MAX_LENGTH),
  /** What changed and why, shown beside the rewrite rather than stored. */
  notes: z
    .array(z.string().trim().min(1).max(OPTIMIZER_NOTE_MAX_LENGTH))
    .max(MAX_OPTIMIZER_NOTES),
});

export type OptimizedPrompt = z.infer<typeof optimizedPromptSchema>;
