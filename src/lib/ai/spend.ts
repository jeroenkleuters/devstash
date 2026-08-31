import { Redis } from "@upstash/redis";

import type { AiUsage } from "@/types/ai";

/**
 * The monthly spend cap.
 *
 * **Nothing here can guarantee you are not charged.** The only control that
 * actually stops the money is the budget limit in the OpenAI dashboard, because
 * it is enforced on their side of the wire and survives every bug in ours. This
 * is the friendly version: it stops the spend early and explains itself, and it
 * is a second line of defence rather than the guarantee.
 *
 * The ledger is **global rather than per-account**, and that is the point. "I
 * will not be charged more than X" is a statement about the owner's bill, not
 * about fairness between subscribers — a per-account cap of a dollar does
 * nothing about fifty accounts spending a dollar each. Per-account caps are
 * worth adding when there are enough subscribers for one to be unfair to the
 * others; this is the one that protects the wallet.
 */

/**
 * Prices per 1M tokens. Reasoning tokens bill at the **output** rate, which is
 * why `reasoning.effort` is a cost dial and not just a latency one.
 */
const PRICE_PER_MILLION = {
  input: 0.05,
  cached: 0.005,
  output: 0.4,
} as const;

/** The ledger holds integers, so every amount is in millionths of a dollar. */
const MICRO_DOLLARS_PER_DOLLAR = 1_000_000;

/** Falls back to a small number rather than to unlimited, if it comes to that. */
const DEFAULT_MONTHLY_BUDGET_USD = 5;

/**
 * How long a ledger read may take before it is treated as unreachable.
 *
 * Shorter than the limiter's, because a visitor is already waiting on a model
 * call after this one — and unlike the limiter, timing out here refuses rather
 * than allows, so this is the wait before a refusal rather than before a pass.
 */
const CHECK_TIMEOUT_MS = 2_000;

/**
 * The ledger's own Redis client, deliberately not shared with `rate-limit.ts`.
 *
 * That module's getter logs "rate limiting is disabled" when the configuration
 * is missing, which would be the wrong thing to say here, and its whole
 * contract is to fail open where this one fails closed. Two HTTP clients in a
 * process is a cheap price for not blurring those two behaviours into one.
 */
let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      redis = new Redis({ url, token });
    } else {
      console.error(
        "AI features are disabled: the spend ledger needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
      redis = null;
    }
  }

  return redis;
}

/** The configured cap in dollars, or the default when it is unset or nonsense. */
export function monthlyBudgetUsd(): number {
  const raw = process.env.AI_MONTHLY_BUDGET_USD;
  const parsed = Number(raw);

  // An unparseable or negative value is a misconfiguration, and reading it as
  // "no budget" would be the one interpretation that spends money.
  if (!raw || !Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MONTHLY_BUDGET_USD;
  }

  return parsed;
}

/** `devstash:ai:spend:2026-08` — one key per calendar month, UTC. */
export function spendKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `devstash:ai:spend:${year}-${month}`;
}

/**
 * What one call cost, in micro-dollars, from the usage the response reported.
 *
 * **Cached tokens are subtracted from the input count before pricing.** The API
 * reports `cached` as a *detail of* `input`, not in addition to it, so pricing
 * both counts bills the cached share twice — once at the cached rate and again
 * at ten times that. It fails in the safe direction, over-counting so the cap
 * trips early, which is exactly why it could sit unnoticed for a long time.
 */
export function costOf(usage: AiUsage): number {
  // Guarded because these come from a remote response: a `cached` larger than
  // `input` would otherwise price negative tokens and credit the ledger.
  const cached = Math.max(0, Math.min(usage.cached, usage.input));
  const uncached = Math.max(0, usage.input - cached);

  const dollars =
    (uncached * PRICE_PER_MILLION.input +
      cached * PRICE_PER_MILLION.cached +
      Math.max(0, usage.output) * PRICE_PER_MILLION.output) /
    1_000_000;

  return Math.round(dollars * MICRO_DOLLARS_PER_DOLLAR);
}

export interface SpendCheck {
  /** Whether a call may be made. */
  allowed: boolean;
  /** Spent so far this month, in dollars. */
  spentUsd: number;
  /** The cap, in dollars. */
  budgetUsd: number;
}

/**
 * Whether there is budget left this month.
 *
 * **Fails closed**, and that is a deliberate inconsistency with `rateLimit`,
 * which fails open and is not changed by this feature. If Redis is unreachable
 * the spend is unknown, and spending an unknown amount against a hard cap is
 * precisely what the cap exists to prevent. The codebase already has this
 * split: `rateLimit` fails open because a limiter that refuses sign-ins during
 * an outage is worse than a burst, while `webhookSecret()` throws because an
 * unverified webhook is a request from anyone claiming to be Stripe. Same
 * reasoning, same shape — an unmetered bill is worse than a disabled feature.
 *
 * The consequence to accept: **an Upstash outage disables AI entirely** and
 * nothing else, and the copy should say so rather than imply the model is down.
 *
 * The check is against spend *so far*, because a call's cost is not known until
 * its response reports the tokens. So **the cap can be overshot by at most one
 * call** — a real property rather than a rounding error to hide. A $5.00 cap
 * means "stops at $5.00, might land at $5.01", which the output-schema caps and
 * the input truncation keep that small.
 */
export async function checkSpend(now: Date = new Date()): Promise<SpendCheck> {
  const budgetUsd = monthlyBudgetUsd();
  const client = getRedis();

  if (!client) {
    return { allowed: false, spentUsd: 0, budgetUsd };
  }

  let micros: number;

  try {
    const read = client.get<number>(spendKey(now));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("spend check timed out")), CHECK_TIMEOUT_MS),
    );

    micros = Number(await Promise.race([read, timeout])) || 0;
  } catch (cause) {
    console.error("AI spend ledger unreachable — refusing the call.", cause);

    return { allowed: false, spentUsd: 0, budgetUsd };
  }

  const spentUsd = micros / MICRO_DOLLARS_PER_DOLLAR;

  // `>=` rather than `>`, matching `usage-limits`: an amount that has reached
  // the cap has used it, so the next call is the one over.
  return { allowed: spentUsd < budgetUsd, spentUsd, budgetUsd };
}

/**
 * Adds one call's cost to this month's ledger.
 *
 * **Never throws.** A ledger write that fails must not turn a suggestion the
 * visitor already has into an error they see — the work is done and the money
 * is spent either way. The cost of that choice is that a failed increment is
 * lost, which is one more reason the dashboard budget limit is the real
 * guarantee and this is the friendly version.
 *
 * The key is given a TTL rather than left forever: it is named for its month,
 * so it is dead the moment the month turns, and 70 days is comfortably past any
 * reconciliation while keeping the keyspace from growing without bound.
 */
export async function recordSpend(
  usage: AiUsage,
  now: Date = new Date(),
): Promise<void> {
  const micros = costOf(usage);

  if (micros <= 0) {
    return;
  }

  const client = getRedis();

  if (!client) {
    return;
  }

  try {
    const key = spendKey(now);
    const total = await client.incrby(key, micros);

    // Only on the first write of the month, when the counter is exactly what
    // we just added — `expire` on every call would push the window forward
    // forever and the key would never fall out.
    if (total === micros) {
      await client.expire(key, 70 * 24 * 60 * 60);
    }
  } catch (cause) {
    console.error("Could not record AI spend — the increment is lost.", cause);
  }
}
