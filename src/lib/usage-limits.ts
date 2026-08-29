/**
 * What a free account may hold, per project overview §8.
 *
 * The numbers live here rather than in the pricing copy so the page and the
 * gate cannot disagree: `pricing-cards.tsx` states them as display strings
 * today and nothing enforces them.
 */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

/** Where an account stands against one of the caps. */
export interface UsageLimit {
  /** Whether one more may be created. */
  allowed: boolean;
  /** The cap, or `null` when there isn't one. */
  limit: number | null;
  /** How many the account holds now. */
  used: number;
  /**
   * How many are left. Never negative — see `usage` below — and `Infinity` when
   * there is no cap, so branch on `limit === null` before rendering it. Note
   * that `Infinity` does not survive JSON, which is another reason `limit` is
   * the field to ask.
   */
  remaining: number;
}

/**
 * The client-side view of one cap.
 *
 * `remaining` is deliberately absent. It is `Infinity` for a Pro account, and
 * nothing that crosses to the browser should have to care whether that survives
 * the trip — the gates in the UI ask `allowed`, and the copy uses `limit` and
 * `used`.
 */
export type ClientUsage = Omit<UsageLimit, "remaining">;

/** Both caps as the browser sees them. */
export interface ClientUsageSnapshot {
  items: ClientUsage;
  collections: ClientUsage;
}

/**
 * The rule both caps follow.
 *
 * Deliberately pure: it takes the count rather than fetching it, so the caller
 * owns the query and this module imports nothing. `src/lib/prisma.ts` throws at
 * import time when `DATABASE_URL` is unset, so a module reaching it can only be
 * tested behind `vi.mock` — keeping this one free of that means its tests
 * exercise the real thing.
 *
 * Two details that are easy to get wrong:
 *
 * - **The boundary is `>=`.** An account holding exactly the limit is *at* it,
 *   not under it, so the next one is refused.
 * - **Being over the limit is a real state, not an impossible one.** A Pro
 *   account that cancels keeps its 60 items against a cap of 50, so `remaining`
 *   clamps at 0 rather than reporting a negative number nothing can render.
 */
function usage(isPro: boolean, used: number, limit: number): UsageLimit {
  // Pro is unlimited, so the count is never consulted.
  if (isPro) {
    return { allowed: true, limit: null, used, remaining: Infinity };
  }

  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

/** Whether the account may create another item. */
export function itemUsage(isPro: boolean, used: number): UsageLimit {
  return usage(isPro, used, FREE_ITEM_LIMIT);
}

/** Whether the account may create another collection. */
export function collectionUsage(isPro: boolean, used: number): UsageLimit {
  return usage(isPro, used, FREE_COLLECTION_LIMIT);
}

/**
 * The copy a refused create answers with.
 *
 * Built from the constant rather than restating it, so the message cannot drift
 * from the rule it explains.
 */
export function itemLimitMessage(): string {
  return `Free accounts are limited to ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`;
}

export function collectionLimitMessage(): string {
  return `Free accounts are limited to ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;
}
