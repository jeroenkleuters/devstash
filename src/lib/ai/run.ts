import {
  APIConnectionError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

import { AI_MODEL, getOpenAI } from "@/lib/openai";
import type { AiResult, AiUsage } from "@/types/ai";

/**
 * The one path every AI feature calls, so error mapping, effort and caching are
 * decided once rather than four times.
 *
 * It **never throws**: everything the SDK can raise is mapped to a failure with
 * a message already fit to show. A feature calling this has one shape to
 * handle, and no way to accidentally leak an SDK error into a toast.
 */

/** Shown when the model is reachable but produced nothing usable. */
export const AI_NO_OUTPUT =
  "The model could not answer that. Try again, or edit the item and retry.";

/** OpenAI's own 429 — theirs, not the per-account limit. */
export const AI_RATE_LIMITED =
  "The AI service is busy right now. Try again in a moment.";

/**
 * Everything else, including a misconfiguration on our side.
 *
 * Deliberately generic. An `AuthenticationError` means **our** API key is
 * wrong, which is not the visitor's fault, is nothing they can act on, and
 * telling them names a piece of our infrastructure. It is logged loudly instead
 * — the same split `startCheckout` makes for an unconfigured Stripe price.
 */
export const AI_UNAVAILABLE =
  "The AI service is unavailable right now. Try again shortly.";

export interface RunStructuredOptions<T> {
  /** The system prompt. Static, and passed as `instructions`. */
  instructions: string;
  /** The untrusted content, wrapped in delimiters before it is sent. */
  input: string;
  schema: z.ZodType<T>;
  /** Names the structured output; the model sees it. */
  schemaName: string;
  effort?: "minimal" | "low" | "medium";
  verbosity?: "low" | "medium";
  /** Versioned per feature, e.g. `devstash:tags:v1`. */
  cacheKey?: string;
}

/**
 * Makes one structured call and returns either the parsed answer with what it
 * cost, or a mapped failure.
 *
 * Three things here are easy to get wrong and expensive to get wrong:
 *
 * - **`instructions` is never concatenated into `input`.** It is the static
 *   prefix, and prompt caching matches on exact prefixes, so mixing the varying
 *   content in destroys every hit. It is also what keeps the untrusted content
 *   textually separate from the instructions about it.
 * - **No sampling parameter is sent.** `gpt-5-nano` is a reasoning model:
 *   `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`,
 *   `logprobs`, `logit_bias` and `max_tokens` are unsupported and **error**
 *   rather than being ignored. Steering is `reasoning.effort` and
 *   `text.verbosity`, and adding any of the others here breaks every feature at
 *   once.
 * - **`output_parsed` can be `null`** when the model refuses or the parse
 *   fails. That is a real branch with its own message, not an impossible one.
 */
export async function runStructured<T>({
  instructions,
  input,
  schema,
  schemaName,
  effort = "low",
  verbosity = "low",
  cacheKey,
}: RunStructuredOptions<T>): Promise<AiResult<T>> {
  try {
    const response = await getOpenAI().responses.parse({
      model: AI_MODEL,
      instructions,
      // Delimited so the prompt can name exactly what it must not obey. It is
      // a speed bump rather than a wall — see the note in `prompts.ts` — and
      // the real defence is that nothing acts on the answer without a person.
      input: `<content>\n${input}\n</content>`,
      reasoning: { effort },
      text: {
        format: zodTextFormat(schema, schemaName),
        verbosity,
      },
      ...(cacheKey ? { prompt_cache_key: cacheKey } : {}),
    });

    const data = response.output_parsed;

    if (data === null || data === undefined) {
      return { ok: false, reason: "no-output", error: AI_NO_OUTPUT };
    }

    return { ok: true, data, usage: usageOf(response.usage) };
  } catch (cause) {
    return mapFailure(cause);
  }
}

/** What the response reported it spent, defaulted rather than trusted. */
function usageOf(usage: {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number } | null;
} | null | undefined): AiUsage {
  return {
    input: usage?.input_tokens ?? 0,
    // Already part of `input_tokens` rather than additional to it, which is
    // what `costOf` has to account for.
    cached: usage?.input_tokens_details?.cached_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
  };
}

/**
 * Turns anything the SDK raised into a failure the caller can show.
 *
 * Nothing is rethrown. An unexpected throw here would reach a server action as
 * a rejected promise, which every form in this codebase has had to learn to
 * catch separately — mapping it once is what stops that.
 */
function mapFailure(cause: unknown): AiResult<never> {
  // Ours, not the visitor's: a bad or missing key, or a key without access to
  // the model. Loud in the log, generic on the screen.
  if (
    cause instanceof AuthenticationError ||
    cause instanceof PermissionDeniedError
  ) {
    console.error(
      "OpenAI rejected our credentials — check OPENAI_API_KEY and its model access.",
      cause,
    );

    return { ok: false, reason: "unavailable", error: AI_UNAVAILABLE };
  }

  // The unset-key guard in `getOpenAI` throws a plain Error, which lands here
  // rather than as an SDK class.
  if (cause instanceof Error && cause.message === "OPENAI_API_KEY is not set") {
    console.error("AI features are configured off: OPENAI_API_KEY is not set.");

    return { ok: false, reason: "unavailable", error: AI_UNAVAILABLE };
  }

  if (cause instanceof RateLimitError) {
    return { ok: false, reason: "rate-limited", error: AI_RATE_LIMITED };
  }

  if (cause instanceof APIConnectionError) {
    return { ok: false, reason: "unavailable", error: AI_UNAVAILABLE };
  }

  console.error("An AI call failed.", cause);

  return { ok: false, reason: "unavailable", error: AI_UNAVAILABLE };
}
