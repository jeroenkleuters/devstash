"use server";

import {
  EXISTING_TAGS_LABEL,
  EXPLAIN_PROMPT,
  OPTIMIZE_PROMPT,
  SUMMARY_PROMPT,
  TAG_PROMPT,
} from "@/lib/ai/prompts";
import { runStructured } from "@/lib/ai/run";
import { budgetExceededMessage, checkSpend, recordSpend } from "@/lib/ai/spend";
import {
  SUMMARY_CHARACTER_BUDGET,
  TAG_CHARACTER_BUDGET,
  truncateForAi,
} from "@/lib/ai/truncate";
import { isCodeType, isPromptType } from "@/constants/item-types";
import { explanationSourceHash } from "@/lib/ai/explanation-cache";
import {
  cacheExplanation,
  getCachedExplanation,
} from "@/lib/db/explanations";
import { AI_MODEL } from "@/lib/openai";
import { getItemDetail } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import {
  aiDraftRequestSchema,
  aiItemRequestSchema,
  codeExplanationSchema,
  explainRequestSchema,
  itemSummarySchema,
  optimizedPromptSchema,
  suggestedTagsSchema,
} from "@/lib/validations/ai";
import { firstIssueMessage } from "@/lib/validations/auth";
import type { z } from "zod";
import type { AiActionResult } from "@/types/ai";
import type { OptimizedPrompt } from "@/lib/validations/ai";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const AI_TURNED_OFF =
  "AI features are switched off for this account. Turn them on in Settings.";
const AI_PRO_REQUIRED = "AI suggestions need a Pro subscription.";
const MISSING = "That item no longer exists.";
const NOT_CODE = "Only snippets and commands can be explained.";
/** Same reasoning as the draft schema's refine: a call that can only
 *  disappoint should not be billed. */
const NOTHING_TO_EXPLAIN = "This item has no code to explain.";
const NOT_PROMPT = "Only prompts can be optimized.";
const NOTHING_TO_OPTIMIZE = "This prompt is empty.";

const HOUR = 60 * 60 * 1000;

/** Per feature, and across all of them. See `guard` for why both. */
const TAG_LIMIT = 30;
const SUMMARY_LIMIT = 30;
const EXPLAIN_LIMIT = 30;
const OPTIMIZE_LIMIT = 30;
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
    input: describeItem(source, TAG_CHARACTER_BUDGET),
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

  return summarize(item);
}

/**
 * The same, for an item that does not exist yet.
 *
 * **The draft path the summaries feature deliberately left out**, and adding it
 * closes the one moment it could not serve: someone who has just written the
 * content is exactly who wants a summary of it, and until now that was the one
 * moment they could not ask.
 *
 * The trade is `suggestTagsForDraft`'s, unchanged — the content crosses the
 * wire because there is no row to read it back from, and what bounds the cost
 * is the preamble this shares rather than where the text came from. Ownership
 * scoping is not weakened, because there is no stored row involved to scope to.
 */
export async function summarizeDraft(
  input: unknown,
): Promise<AiActionResult<string>> {
  const gate = await guard(
    input,
    aiDraftRequestSchema,
    "summary",
    SUMMARY_LIMIT,
  );

  if (!gate.ok) {
    return gate.failure;
  }

  return summarize(gate.data);
}

/** The call itself, once something has been resolved to summarise. */
async function summarize(source: {
  title: string;
  content: string | null;
}): Promise<AiActionResult<string>> {
  const result = await runStructured({
    instructions: SUMMARY_PROMPT,
    // No existing tags and no current description: the model is being asked
    // what the item *is*, and feeding it a description it is about to replace
    // invites it to paraphrase that instead of reading the item. That holds
    // for a draft too, where the field may already hold something typed.
    input: describeItem(
      { ...source, description: null, tags: [] },
      SUMMARY_CHARACTER_BUDGET,
    ),
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

/**
 * Explains one of the caller's code items.
 *
 * **The one AI feature with no accept step**, because there is no field the
 * answer belongs in: it is read, optionally copied, and never written. That
 * also makes it the only one that could gain streaming later without a
 * redesign — the panel displays a result rather than merging one.
 *
 * **Refused for anything but a code type**, and refused *before* the model is
 * called. `isCodeType` is the same predicate that already decides which types
 * get the Monaco editor, so there is no second list to keep in step, and
 * explaining a note is not a feature worth billing for.
 *
 * **`verbosity: "medium"` with `effort: "low"`**, which is the split worth
 * understanding rather than a compromise between them. Verbosity governs how
 * much answer is produced, and this is the one feature whose answer *is* the
 * product, so it keeps the higher setting. Effort governs how long the model
 * deliberates before writing, it is billed at the output rate, and it was the
 * single largest contributor to how long this feature took to respond — on a
 * model this small the extra deliberation was not buying an answer worth the
 * wait.
 *
 * Lowering it does **not** invalidate anything already cached:
 * `explanationSourceHash` covers the code and the language hint, and
 * `freshExplanation` also compares `AI_MODEL`, but neither sees `effort`.
 * Answers produced at the old setting stay served, which is right — they are
 * still good answers — and Regenerate is there for anyone who disagrees.
 */
export async function explainCode(
  input: unknown,
): Promise<AiActionResult<string>> {
  // `authorize` rather than the whole `guard`: the cache is consulted before
  // the rate limits, so a hit does not spend one of the caller's attempts.
  const gate = await authorize(input, explainRequestSchema);

  if (!gate.ok) {
    return gate.failure;
  }

  const item = await getItemDetail(gate.user.id, gate.data.itemId);

  if (!item) {
    return { success: false, error: MISSING };
  }

  if (!isCodeType(item.type.slug)) {
    return { success: false, error: NOT_CODE };
  }

  if (!item.content) {
    return { success: false, error: NOTHING_TO_EXPLAIN };
  }

  // Keyed on the code and the hint, never on `Item.updatedAt` — Prisma bumps
  // that on every write, so a star or a rename would throw away an answer that
  // is still correct. The item was read with the session's user in the `where`,
  // which is what makes this id safe to hand to the cache.
  const sourceHash = explanationSourceHash(item.content, item.language);

  // Only the *read* is skipped when regenerating. Everything below still runs,
  // because asking again is a real call and costs what a first ask costs.
  const cached = gate.data.regenerate
    ? null
    : await getCachedExplanation(item.id, sourceHash, AI_MODEL);

  if (cached) {
    return { success: true, data: cached };
  }

  const spend = await allowSpend(gate.user.id, "explain", EXPLAIN_LIMIT);

  if (spend) {
    return spend;
  }

  const result = await runStructured({
    instructions: EXPLAIN_PROMPT,
    // Spelled out rather than passing `item`: narrowing `item.content` above
    // does not narrow the object it belongs to.
    input: describeCode({ content: item.content, language: item.language }),
    schema: codeExplanationSchema,
    schemaName: "code_explanation",
    effort: "low",
    verbosity: "medium",
    cacheKey: "devstash:explain:v1",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await recordSpend(result.usage).catch(() => {});

  // Best effort, for the reason `recordSpend` is: the visitor already has the
  // answer and the money is already spent, so a failed cache write must not
  // turn that into an error they see. The cost is paying again next time.
  await cacheExplanation(
    item.id,
    result.data.explanation,
    sourceHash,
    AI_MODEL,
  ).catch(() => {});

  return { success: true, data: result.data.explanation };
}

/**
 * Rewrites one of the caller's prompts, and says what it changed.
 *
 * **Refused for anything but a prompt.** `isPromptType` is its own set rather
 * than `isMarkdownType`, which is also true for notes: a note is prose about
 * something, where a prompt is an instruction to a model and the only kind of
 * text "rewrite this so it works better" means anything for.
 *
 * `effort: "low"`, `verbosity: "medium"` — this is rewriting rather than
 * analysis, so the output *is* the artifact and is where the tokens should go.
 *
 * **It writes nothing**, like every other AI action. The rewrite comes back
 * beside the original, the user accepts it into the form's local state, and
 * the existing `updateItem` saves it on their own Save. That matters more here
 * than anywhere else: the thing being replaced is long, and a rewrite the user
 * cannot compare against the original is a rewrite they cannot judge — which
 * is why `AiOptimizablePrompt` shows both rather than replacing the field and
 * offering undo. Undo restores a value they were never able to weigh.
 *
 * **This is the sharpest prompt-injection case in the app, and the defence is
 * structural rather than textual.** The input is literally a prompt, so it
 * will contain instructions; constrained to `{ optimized, notes }` the model
 * cannot call a tool, take an action or emit anything else, and a person
 * accepts the result before it reaches the database. An injection can make a
 * rewrite bad. It cannot make it dangerous. See `OPTIMIZE_PROMPT` for why
 * input sanitization is deliberately absent.
 */
export async function optimizePrompt(
  input: unknown,
): Promise<AiActionResult<OptimizedPrompt>> {
  const gate = await guard(
    input,
    aiItemRequestSchema,
    "optimize",
    OPTIMIZE_LIMIT,
  );

  if (!gate.ok) {
    return gate.failure;
  }

  const item = await getItemDetail(gate.user.id, gate.data.itemId);

  if (!item) {
    return { success: false, error: MISSING };
  }

  if (!isPromptType(item.type.slug)) {
    return { success: false, error: NOT_PROMPT };
  }

  if (!item.content) {
    // The draft schema's reasoning: a call that can only disappoint should not
    // be billed.
    return { success: false, error: NOTHING_TO_OPTIMIZE };
  }

  const result = await runStructured({
    instructions: OPTIMIZE_PROMPT,
    // The prompt and nothing else. The title is what the *user* calls it and
    // says nothing about how it performs, and a description would only give
    // the model something to paraphrase instead of reading the prompt.
    //
    // It goes in `input`, where the wrapper delimits it, and never into
    // `instructions` — that separation is the injection boundary, and it is
    // the one thing here worth asserting for its own sake.
    input: truncateForAi(item.content),
    schema: optimizedPromptSchema,
    schemaName: "optimized_prompt",
    effort: "low",
    verbosity: "medium",
    cacheKey: "devstash:optimize:v1",
  });

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  await recordSpend(result.usage).catch(() => {});

  return { success: true, data: result.data };
}

/**
 * The code as the model sees it: the code, and the language hint when the item
 * carries one.
 *
 * No title and no description — an explanation is supposed to come from reading
 * the code, and a title saying what the snippet is for is exactly the thing a
 * model will paraphrase instead of doing the work. The hint goes in because
 * `Item.language` is free text a person chose, and it disambiguates syntax that
 * several languages share.
 *
 * Truncated as one block, so the hint cannot be pushed out by a long file, and
 * `truncateForAi` takes the **head** — a file's imports and top-level structure
 * are where an explanation starts.
 */
function describeCode(item: { content: string; language: string | null }): string {
  const parts = item.language ? [`Language: ${item.language}`] : [];

  parts.push(`Code:\n${item.content}`);

  return truncateForAi(parts.join("\n\n"));
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
  const auth = await authorize(input, schema);

  if (!auth.ok) {
    return auth;
  }

  const spend = await allowSpend(auth.user.id, feature, limit);

  if (spend) {
    return { ok: false, failure: spend };
  }

  return auth;
}

/**
 * Steps 1 to 4 — who is asking, whether they have AI on, whether they are Pro,
 * and whether the request is even the right shape.
 *
 * Split from the two that follow so an action can do something in between.
 * `explainCode` is the one that does: a cached answer costs nothing, so it
 * reads the item and consults the cache here, and only reaches `allowSpend` on
 * a miss. Everything else runs the two halves back to back through `guard`.
 */
async function authorize<T>(
  input: unknown,
  schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> },
): Promise<Guarded<T>> {
  const refuse = (error: string): Guarded<T> => ({
    ok: false,
    failure: { success: false, error },
  });

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

  return { ok: true, user, data: parsed.data };
}

/**
 * Steps 5 and 6 of the sequence above, on their own so an action can do
 * something between them and the checks before them.
 *
 * `explainCode` is why: a cached answer costs nothing, so it must not spend one
 * of the caller's hourly attempts, which means the cache is consulted first and
 * this runs only on a miss.
 *
 * Answers `null` when the call may proceed, and the refusal otherwise.
 */
async function allowSpend(
  userId: string,
  feature: string,
  limit: number,
): Promise<AiActionResult<never> | null> {
  const [perFeature, combined] = [
    await rateLimit(`ai:${feature}:${userId}`, limit, HOUR),
    await rateLimit(`ai:all:${userId}`, COMBINED_LIMIT, HOUR),
  ];

  if (!perFeature.success || !combined.success) {
    // Quotes only the window that actually failed, so an action checking two
    // never overstates the wait.
    return {
      success: false,
      error: tooManyAttemptsMessage(perFeature, combined),
    };
  }

  const budget = await checkSpend();

  if (!budget.allowed) {
    // The flag is what lets `BillingProvider` hold this for the session, so a
    // second click does not spend a round trip discovering the same thing.
    return {
      success: false,
      error: budgetExceededMessage(budget),
      budgetExceeded: true,
    };
  }

  return null;
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
function describeItem(
  item: {
    title: string;
    description: string | null;
    content: string | null;
    tags: string[];
  },
  budget: number,
): string {
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
  // cannot push the title out of what is sent. The budget is the caller's
  // because the two features sharing this helper need different amounts:
  // tagging reads the opening, summarising reads further in.
  return truncateForAi(parts.join("\n\n"), budget);
}
