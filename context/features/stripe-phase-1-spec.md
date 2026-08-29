# Stripe Phase 1 — Core Infrastructure

## Overview

The plumbing for DevStash Pro subscriptions ($8/mo, $72/yr): the Stripe client,
the billing types and schema, the row reads and writes, `isPro` on the current
user, and a pure `usage-limits` module holding the free-tier rules.

**Nothing in this phase is user-visible and nothing is enforced.** No checkout,
no webhook, no gate, no UI. Every module lands with its consumers still absent,
so the app builds and behaves identically before and after. That is the point of
the split: everything here can be proven with `npm test`, while Phase 2 needs the
Stripe CLI, a browser and a card number.

Reference: @docs/stripe-integration-plan.md — §4.1–4.4, §5.1, §5.3, §5.4, §5.11,
and steps 1–5 of §8. Code examples for every file below are in that document.

## Requirements

- `npm install stripe` — one runtime dependency
- No migration. `User.isPro`, `stripeCustomerId` and `stripeSubscriptionId` have
  been in the schema since `20260814120000_init` and have never been used
- The free-tier rules live in **one pure module** that imports nothing which
  throws at import time, so it is testable without mocking Prisma
- Unit tests for the `usage-limits` module (see Testing)
- `npm test`, `npx tsc --noEmit`, `npx eslint src` and `npm run build` clean
- No behaviour change: `/dashboard`, `/items/*`, `/collections`, `/settings` and
  the create flows all work exactly as before

## Files to create

| File | Contents |
|---|---|
| `src/lib/usage-limits.ts` | `FREE_ITEM_LIMIT`, `FREE_COLLECTION_LIMIT`, and the pure predicates the Phase 2 gates call |
| `src/lib/usage-limits.test.ts` | The tests below |
| `src/lib/stripe.ts` | `getStripe()`, `priceIdFor(plan)`, `webhookSecret()` |
| `src/types/billing.ts` | `BILLING_PLANS`, `BillingPlan`, `StartCheckoutResult`, `BillingPortalResult` |
| `src/lib/validations/billing.ts` | `startCheckoutSchema` |
| `src/lib/validations/billing.test.ts` | The plan enum accepts both plans, refuses a raw `price_…` and an unknown plan |
| `src/lib/db/billing.ts` | `getStripeCustomerId`, `setStripeCustomerId`, `applySubscriptionState` |

## Files to modify

| File | Change |
|---|---|
| `src/lib/db/user.ts` | `isPro` and `hasBilling` on `CurrentUser`, two columns added to the existing `select` |
| `src/lib/db/items.ts` | `countItems(userId)` — a `cache()`d `prisma.item.count`, cheaper than `getItemStats` which also counts favorites |
| `src/lib/app-url.ts` | `configuredOrigin()` — `APP_URL` with **no request fallback**, throwing when unset |
| `.env.example` | Document the four Stripe entries; values stay empty |

## The usage-limits module

This is the piece the phase exists to get right, and its shape is chosen so it
can be tested at all.

- **Pure functions over numbers and booleans.** It takes `isPro` and a count and
  answers whether one more is allowed. It does **not** query — the caller
  fetches the count and passes it in. `src/lib/prisma.ts` throws at import time
  when `DATABASE_URL` is unset, so a module importing it can only be tested
  behind `vi.mock("@/lib/prisma")`; keeping this one pure means its tests import
  it directly and assert real behaviour rather than a mock's.
- **The numbers live here, not in the marketing copy.** `pricing-cards.tsx`
  currently states `"50 items"` and `"3 collections"` as display strings and
  nothing enforces them. Phase 2 points that page at these constants so the page
  and the gate cannot disagree.
- **Pro is unlimited**, so `isPro` short-circuits before the count is consulted.
- **The boundary is `>=`, not `>`.** An account holding exactly the limit is at
  it, not under it.
- **Over the limit is a real state, not an impossible one.** A Pro account that
  cancels can hold 60 items against a limit of 50. The module must describe that
  honestly — refusing another, reporting `remaining` as 0 rather than a negative
  number — because Phase 2 renders it.

Suggested surface, adjust while writing:

```ts
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

export interface UsageLimit {
  allowed: boolean;   // may one more be created
  limit: number | null;  // null when unlimited
  used: number;
  remaining: number;  // never negative
}

export function itemUsage(isPro: boolean, used: number): UsageLimit;
export function collectionUsage(isPro: boolean, used: number): UsageLimit;
export function itemLimitMessage(): string;       // the copy the gate returns
export function collectionLimitMessage(): string;
```

## Notes

### Why `isPro` goes on `CurrentUser` and not on the session token

The research prompt behind the plan proposed syncing `isPro` into the JWT on
every session validation. **Do not.** `useSession()` and `SessionProvider` appear
nowhere in `src/`, so there is no client session to keep in sync, and
`getCurrentUser()` already reads the row on every request behind React's
`cache()`. Two more columns on a `findUnique` that is already running costs
nothing; a token claim would cost a query *and* add a second, staler source of
truth for a value a webhook changes behind the visitor's back. A plain reload
after checkout is then enough. See plan §0.1.

### `hasBilling`, not `stripeCustomerId`

Expose whether the account has a Stripe customer, not the id — the same
reduction `hasPassword` already makes for `passwordHash`, so the id never
reaches a component's props. Destructure it out alongside `passwordHash`.

### `configuredOrigin()` rather than reusing `appOrigin()`

`appOrigin(request)` takes a `Request`, which a server action does not have, and
falls back to the request's own origin — which Next derives from the caller's
`Host` header. Stripe's `success_url` and `return_url` must never come from that:
it is the exact attack `appOrigin` was written to prevent. The new function reads
`APP_URL` and throws when unset, with no fallback in any environment. `APP_URL`
therefore becomes strictly required for billing.

### Fail closed

`webhookSecret()` throws rather than returning undefined. A handler that cannot
verify a signature must refuse the request, and a throw is what keeps that from
being forgotten. This deliberately differs from `rateLimit`, which fails *open*
on missing Upstash config — an unguarded rate limit is a nuisance, an unverified
webhook is a free Pro account.

### What is deliberately **not** here

- `PRO_TYPE_SLUGS` gaining `books`, and `isProType`. The sidebar renders its
  `PRO` badge straight from that set, so adding the slug is a visible UI change
  the moment it lands. It belongs with the gate that justifies it — Phase 2.
- Any gate in `createItem`, `createCollection` or `POST /api/upload`.
- The webhook route, the billing actions, the settings card.

## Testing

`vitest.config.mts` collects only `src/lib/**/*.test.ts` and
`src/actions/**/*.test.ts`. Everything this phase adds is in `src/lib/`, so all
of it is reachable — which is the other reason the phase is drawn here.

### `src/lib/usage-limits.test.ts`

- Pro is unlimited: allowed at 0, at the limit, and far past it
- Pro reports `limit: null`
- Free below the limit is allowed, and `remaining` counts down correctly
- Free at exactly the limit is refused — **the `>=` boundary**
- Free one under the limit is allowed
- Free over the limit (a downgraded account) is refused
- Free over the limit reports `remaining: 0`, never a negative
- Both item and collection variants, against their own constants
- The two constants are 50 and 3, matching project overview §8
- The messages name the number, so the copy cannot drift from the rule

**Mutation-check two of these** (house practice): changing `>=` to `>` must fail
exactly the at-the-limit test, and dropping the `Math.max(0, …)` on `remaining`
must fail exactly the over-limit one. Revert both.

### `src/lib/validations/billing.test.ts`

- Accepts `monthly` and `yearly`
- Refuses an unknown plan, and refuses a raw `price_1U9…` — the client names a
  choice, the server resolves it to a price, so a price id must never parse

### Not testable in this phase

`src/lib/stripe.ts` and `src/lib/db/billing.ts` reach a live SDK and Prisma
respectively. Their behaviour is proven in Phase 2 against `stripe listen`. If
you want something here, `priceIdFor` and `webhookSecret` are pure enough to
exercise with `vi.stubEnv` — Vitest loads no `.env`, so the unconfigured branches
are the default state and need no setup.

## References

- @docs/stripe-integration-plan.md — code for every file above
- @context/coding-standards.md — action shape, validation, testing scope
- `src/lib/upload-preferences.ts` and `src/lib/file-constraints.ts` — the
  existing pure-rules-module pattern this follows
