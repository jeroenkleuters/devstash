"use server";

import {
  EXISTING_TAGS_LABEL,
  SUMMARY_PROMPT,
  TAG_PROMPT,
} from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/run";
import { budgetExceededMessage, checkSpend, recordSpend } from "@/lib/ai/spend";
import { truncateForAi } from "@/lib/ai/truncate";
import { getItemDetail } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import {
  aiDraftRequestSchema,
  aiItemRequestSchema,
  itemSummarySchema,
  suggestedTagsSchema,
} from "@/lib/validations/ai";
import { firstIssueMessage } from "@/lib/validations/auth";
import type { z } from "zod";
import type { AiActionResult } from "@/types/ai";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const AI_TURNED_OFF =
  "AI features are switched off for this account. Turn them on in Settings.";
const AI_PRO_REQUIRED = "AI suggestions need a Pro subscription.";
const MISSING = "That item no longer exists.";

const HOUR = 60 * 60 * 1000;

/** Per feature, and across all four. See `guard` for why both. */
const TAG_LIMIT = 30;
const SUMMARY_LIMIT = 30;
const COMBINED_LIMIT = 60;

/**
 * Suggests tags for one of the caller's items.
 *
 * **It writes nothing.** The suggestions come back as strings, the user accepts
 * the ones they want into the form's local state, and the existing `updateItem`
 * saves them on Save. That is the design rather than a shortcut: `updateItem`
 * already owns the ownership scoping, the payload-field rule and the tag
 * `connectOrCreate` against `Tag.@@unique([userId, name])`, so an AI action that
 * wrote tags would reproduce all of it and be a second write path to audit.
 *
 * **The request names an item id, never content**, and that is what the whole
 * action rests on. Content in the payload would let any signed-in account spend
 * the OpenAI budget on arbitrary text — the app would be a free proxy to a paid
 * API. An id is read through `getItemDetail`, which puts the session's `userId`
 * in the `where`, so the text is provably the caller's own and already bounded
 * by what they were allowed to store. Same shape `createItem` uses for
 * `typeSlug` and `startCheckout` for a plan: the client names a choice, the
 * server resolves it to a value.
 */
export async function suggestTags(
  input: unknown,
): Promise<AiActionResult<string[]>> {
  const gate = await guard(input, aiItemRequestSchema, "tags", TAG_LIMIT);

  if (!gate.ok) {
    return gate.failure;
  }

  // Read with the session's user in the `where`, so the text is provably the
  // caller's own. This is the ownership scoping the id-over-content design
  // actually buys, and it is the last thing to happen before the money is
  // spent.
  const item = await getItemDetail(gate.user.id, gate.data.itemId);

  if (!item) {
    // Missing and not-yours are one answer, because the query does not tell
    // them apart — the same conflation every other read in `lib/db/` makes.
    return { success: false, error: MISSING };
  }

  return suggest(item);
}

/**
 * The same, for an item that does not exist yet.
 *
 * The create dialog is the moment someone most wants tags, and there is no row
 * to read from — so this is the one path where content crosses the wire rather
 * than being read back from the caller's own rows.
 *
 * **The trade was made deliberately and it is narrower than it looks.** The
 * spec's reason for id-only was that content in a payload turns the app into a
 * free proxy to a paid API. In practice a caller who wanted that could already
 * create an item, ask about it and delete it — one extra write — so what
 * actually bounds the cost is the preamble this shares: Pro only, 30 an hour
 * for tags, 60 across all AI, the global monthly cap, and truncation before
 * anything is sent. What id-over-content really buys is ownership scoping, and
 * there is no stored row here to scope to.
 *
 * It writes nothing, like its sibling.
 */
export async function suggestTagsForDraft(
  input: unknown,
): Promise<AiActionResult<string[]>> {
  const gate = await guard(input, aiDraftRequestSchema, "tags", TAG_LIMIT);

  if (!gate.ok) {
    return gate.failure;
  }

  return suggest(gate.data);
}

/** The call itself, once something has been resolved to describe. */
async function suggest(source: {
  title: string;
  description: string | null;
  content: string | null;
  tags: string[];
}): Promise<AiActionResult<string[]>> {
  const result = await runStructured({
    instructions: TAG_PROMPT,
    input: describeItem(source),
    schema: suggestedTagsSchema,
    schemaName: "suggested_tags",
    // Classification, and reasoning tokens bill at the *output* rate — so
    // minimal effort here is the largest per-call saving available.
    effort: "minimal",
    verbosity: "low",
    cacheKey: "devstash:tags:v1",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  // `recordSpend` swallows its own failures, and the catch here is the second
  // half of that guarantee rather than a duplicate of it: the suggestion is
  // already in hand and the money is already spent, so nothing that happens to
  // the ledger afterwards should turn it into an error the visitor sees. The
  // cost is a lost increment, which is why the dashboard budget limit is the
  // real cap and this is the friendly one.
  await recordSpend(result.usage).catch(() => {});

  return { success: true, data: result.data.tags };
}

/**
 * Summarises one of the caller's items into a sentence or three.
 *
 * **The same shape as `suggestTags` and deliberately so** — the id rather than
 * the content, the shared `guard`, and nothing written. What differs is only
 * where the answer goes and what it costs.
 *
 * **Accepting it *replaces* the Description field**, which is the one
 * behavioural difference from tags: tags merge into what is already there, a
 * description overwrites it. That is a UI concern rather than one this action
 * can enforce, and `AiSummarySuggestion` is what shows the existing value
 * alongside the offer so nothing is lost silently.
 *
 * `effort: "low"` rather than tagging's `"minimal"`: this has to actually read
 * the item to say what it is for, where classification does not. Still `low`
 * and not higher, because reasoning tokens bill at the *output* rate and there
 * is nothing here to reason about beyond comprehension.
 */
export async function summarizeItem(
  input: unknown,
): Promise<AiActionResult<string>> {
  const gate = await guard(
    input,
    aiItemRequestSchema,
    "summary",
    SUMMARY_LIMIT,
  );

  if (!gate.ok) {
    return gate.failure;
  }

  const item = await getItemDetail(gate.user.id, gate.data.itemId);

  if (!item) {
    return { success: false, error: MISSING };
  }

  const result = await runStructured({
    instructions: SUMMARY_PROMPT,
    // No existing tags and no current description: the model is being asked
    // what the item *is*, and feeding it a description it is about to replace
    // invites it to paraphrase that instead of reading the item.
    input: describeItem({ ...item, description: null, tags: [] }),
    schema: itemSummarySchema,
    schemaName: "item_summary",
    effort: "low",
    verbosity: "low",
    cacheKey: "devstash:summary:v1",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await recordSpend(result.usage).catch(() => {});

  return { success: true, data: result.data.summary };
}

/** What a gate refused, or the caller and their validated request. */
type Guarded<T> =
  | { ok: true; user: { id: string }; data: T }
  | { ok: false; failure: AiActionResult<never> };

/**
 * The checks every AI action makes, in the order they have to happen.
 *
 * **The order is the security and cost property**, not house style, and each
 * position earns itself:
 *
 * 1. **Session** first — `getCurrentUser` is `cache()`d, so this is free if
 *    anything in the request already asked, and it carries `aiPreferences` and
 *    `isPro` so the next two checks cost no query either.
 * 2. **The off switch before the Pro check.** Selling an upgrade for a feature
 *    someone deliberately switched off is nonsense, and it sells at the worst
 *    possible moment.
 * 3. **Pro before the rate limit**, the ordering `POST /api/upload` already
 *    establishes: a free account should be told it needs Pro rather than told to
 *    wait for a window that will refuse it again.
 * 4. **Shape before the limiters**, so a malformed request does not spend one of
 *    the caller's own attempts.
 * 5. **Both limits before the spend cap.** The limiter keeps an in-memory cache
 *    of identifiers it has already rejected, so a repeat offender is answered
 *    with no round trip at all. The combined ceiling is the one that protects
 *    the budget — four separate windows would let a determined caller make 100
 *    calls an hour whatever the mix.
 * 6. **The spend cap last**, so a caller in a loop is stopped before anything
 *    it does costs a database query, let alone an API call. Reading the item
 *    happens *after* this returns, in the action that needs one — which is why
 *    the draft path can share every check without pretending to have a row.
 *
 * Generic over the request schema so both entry points run the same sequence
 * in the same order. That ordering is the security and cost property, and the
 * tests assert it by the absence of the later calls.
 */
async function guard<T>(
  input: unknown,
  schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> },
  feature: string,
  limit: number,
): Promise<Guarded<T>> {
  const refuse = (
    error: string,
    extra?: { budgetExceeded: true },
  ): Guarded<T> => ({ ok: false, failure: { success: false, error, ...extra } });

  const user = await getCurrentUser();

  if (!user) {
    return refuse(SIGNED_OUT);
  }

  if (!user.aiPreferences.enabled) {
    return refuse(AI_TURNED_OFF);
  }

  if (!user.isPro) {
    return refuse(AI_PRO_REQUIRED);
  }

  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return refuse(firstIssueMessage(parsed.error));
  }

  const [perFeature, combined] = [
    await rateLimit(`ai:${feature}:${user.id}`, limit, HOUR),
    await rateLimit(`ai:all:${user.id}`, COMBINED_LIMIT, HOUR),
  ];

  if (!perFeature.success || !combined.success) {
    // Quotes only the window that actually failed, so an action checking two
    // never overstates the wait.
    return refuse(tooManyAttemptsMessage(perFeature, combined));
  }

  const budget = await checkSpend();

  if (!budget.allowed) {
    // The flag is what lets `BillingProvider` hold this for the session, so a
    // second click does not spend a round trip discovering the same thing.
    return refuse(budgetExceededMessage(budget), { budgetExceeded: true });
  }

  return { ok: true, user, data: parsed.data };
}

/**
 * The item as the model sees it: what the user wrote, and nothing else.
 *
 * No id, no owner, no collection names, no filename — the privacy page says
 * only the title, description and content are sent, and this is the function
 * that has to keep that true.
 *
 * Existing tags go too, and the prompt tells the model not to repeat them:
 * cheaper than deduping the answer afterwards, and it produces better
 * suggestions than asking blind.
 */
function describeItem(item: {
  title: string;
  description: string | null;
  content: string | null;
  tags: string[];
}): string {
  const parts = [`Title: ${item.title}`];

  if (item.description) {
    parts.push(`Description: ${item.description}`);
  }

  if (item.tags.length > 0) {
    parts.push(`${EXISTING_TAGS_LABEL}: ${item.tags.join(", ")}`);
  }

  if (item.content) {
    parts.push(`Content:\n${item.content}`);
  }

  // Truncated as one block rather than per field, so a huge content field
  // cannot push the title out of what is sent.
  return truncateForAi(parts.join("\n\n"));
}
