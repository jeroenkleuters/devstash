/**
 * The checks every AI action makes before it costs anything.
 *
 * Lives here rather than in `src/actions/ai.ts` because none of it is an
 * action: a `"use server"` module may only export async functions, so the
 * `Guarded` type could not be exported from there at all, and the rest is plain
 * logic that happens to be async. Same direction `savePreferences` and
 * `withSession` already went.
 *
 * The per-feature limits stay with the actions, since each names its own. The
 * combined ceiling is this module's, because it is the one that protects the
 * budget across all of them.
 */

import { budgetExceededMessage, checkSpend } from "@/lib/ai/spend";
import { getCurrentUser } from "@/lib/db/user";
import { rateLimit, tooManyAttemptsMessage } from "@/lib/rate-limit";
import { SIGNED_OUT } from "@/constants/messages";
import { firstIssueMessage } from "@/lib/validations/auth";
import type { z } from "zod";
import type { AiActionResult } from "@/types/ai";

const AI_TURNED_OFF =
  "AI features are switched off for this account. Turn them on in Settings.";
const AI_PRO_REQUIRED = "AI suggestions need a Pro subscription.";

const HOUR = 60 * 60 * 1000;

/** The ceiling across every AI feature. See `guard` for why both windows. */
const COMBINED_LIMIT = 60;

/** What a gate refused, or the caller and their validated request. */
export type Guarded<T> =
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
export async function guard<T>(
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
export async function authorize<T>(
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
export async function allowSpend(
  userId: string,
  feature: string,
  limit: number,
): Promise<AiActionResult<never> | null> {
  // `Promise.all`, not an array of awaits: an array literal evaluates left to
  // right, so awaiting inside one is two sequential round trips wearing the
  // shape of a parallel pair. The two windows are independent — neither result
  // decides whether the other is worth checking — and this sits on the hot path
  // of every AI action, before the model is reached. Safe because `rateLimit`
  // catches its own failures and fails open, so there is no sibling rejection
  // to go unhandled. Same shape the two-window auth routes already use.
  const [perFeature, combined] = await Promise.all([
    rateLimit(`ai:${feature}:${userId}`, limit, HOUR),
    rateLimit(`ai:all:${userId}`, COMBINED_LIMIT, HOUR),
  ]);

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
