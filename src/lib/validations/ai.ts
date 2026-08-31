import { z } from "zod";

import {
  DESCRIPTION_MAX_LENGTH,
  TAG_MAX_LENGTH,
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

export type ItemSummary = z.infer<typeof itemSummarySchema>;

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
 * A rewritten prompt is offered for the visitor to accept into the item, so it
 * is held to what `content` can hold in practice rather than to a column limit
 * — `content` is `@db.Text` and has none.
 */
const OPTIMIZED_PROMPT_MAX_LENGTH = 8_000;
const OPTIMIZER_NOTE_MAX_LENGTH = 1_000;

export const optimizedPromptSchema = z.object({
  prompt: z.string().trim().min(1).max(OPTIMIZED_PROMPT_MAX_LENGTH),
  /** What changed and why, shown beside the rewrite rather than stored. */
  note: z.string().trim().max(OPTIMIZER_NOTE_MAX_LENGTH),
});

export type OptimizedPrompt = z.infer<typeof optimizedPromptSchema>;
