# Stripe Phase 2 — Integration & UI

## Overview

Everything Phase 1 left unwired: the webhook that flips `isPro`, the checkout and
billing-portal actions, the settings card that starts them, and the free-tier
gates on creating items, collections and uploads.

This is where the feature becomes real and where it can lock a user out.
**Requires the Stripe CLI** (`stripe listen`, `stripe trigger`) and a browser —
route handlers and components are uncollectable by `vitest.config.mts`, so the
webhook and the card cannot be unit-tested and are verified by hand.

Depends on Phase 1 (@context/features/stripe-phase-1-spec.md) being merged.
Reference: @docs/stripe-integration-plan.md — §4.5–4.7, §5.2, §5.5–5.10, §6, §7,
and steps 6–15 of §8.

## Requirements

- Stripe Dashboard configured first: one product, two recurring prices, customer
  portal activated (plan §6)
- `stripe listen --forward-to localhost:3000/api/stripe/webhook` running, its
  `whsec_…` in `.env` — it differs from the dashboard endpoint's secret
- The webhook is the security boundary: signature-verified, outside the proxy
  matcher, idempotent
- Checkout and portal are **server actions**; the webhook is an **API route**
- Free-tier gates enforced on *create* only — existing content stays readable,
  editable and deletable
- Books become a Pro type
- `npm test`, `npx tsc --noEmit`, `npx eslint src`, `npm run build` clean

## Files to create

| File | Contents |
|---|---|
| `src/app/api/stripe/webhook/route.ts` | Signature verification, the four handled events, the `isPro` write |
| `src/actions/billing.ts` | `startCheckout(input)`, `openBillingPortal()` |
| `src/actions/billing.test.ts` | See Testing |
| `src/components/settings/settings-billing.tsx` | The plan card — upgrade, or manage billing |

## Files to modify

| File | Change |
|---|---|
| `src/constants/item-types.ts` | `books` joins `PRO_TYPE_SLUGS`; add `isProType(slug)` |
| `src/actions/items.ts` | Gate `createItem` on the Pro type and the item cap |
| `src/actions/collections.ts` | Gate `createCollection` on the collection cap |
| `src/app/api/upload/route.ts` | 403 for a free account, ahead of the rate limit |
| `src/lib/upload-file.ts` | `UploadNotAllowedError` for a 403, alongside the existing 429 handling |
| `src/components/items/item-drop-zone.tsx` | Stop the batch on that error |
| `src/app/settings/page.tsx` | Render `SettingsBilling` second |
| `src/components/marketing/pricing-cards.tsx` | CTAs point somewhere real; render the `FREE_*` constants instead of literals |

## The webhook

- Read the body with `request.text()`, never `request.json()` — reparsing
  changes the bytes the signature covers
- `constructEventAsync`, not `constructEvent` — the async form uses SubtleCrypto
  and is what Stripe documents for Next.js route handlers
- Handle `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Acknowledge
  everything else with 200 — a non-2xx makes Stripe retry forever
- `active` and `trialing` entitle Pro; every other status does not
- Key the write on `stripeCustomerId`, not on a user id from the payload — the
  customer id is the only field in Stripe's payload this app has itself stored
- `updateMany`, so a customer with no matching row is a no-op rather than a
  `P2025` that fails the delivery
- Clear `stripeSubscriptionId` when the subscription stops entitling Pro. The
  column is `@unique`, so a cancelled id left behind blocks a re-subscribe
- **Must stay out of `src/proxy.ts`'s matcher.** The proxy answers an
  unauthenticated request with a redirect, which Stripe reads as a failed
  delivery. Its authentication is the signature, not a session
- Idempotent by construction: it writes an absolute state derived from the
  subscription, never a delta, so a replay costs nothing and no `processedEvents`
  table is needed

## The gates

Insert after the session and type checks in each action, per plan §5.5–5.7.
Switch `getCurrentUserId()` for `getCurrentUser()` — it is `cache()`d, so the
whole row costs what the id did.

- `createItem`: refuse a Pro type for a free account, then refuse at the item cap
- `createCollection`: refuse at the collection cap
- `POST /api/upload`: 403 for a free account, **before** the rate limit — a free
  account should be told it needs Pro, not told to wait

Messages come from `usage-limits`; do not restate the numbers.

### Books

`books` joins `files` and `images` in `PRO_TYPE_SLUGS`. A book's cover goes
through the image upload path, so it costs the storage that gates images — and
it makes the Pro slugs and the upload-holding types the **same set**, which is
what lets the upload route check `isPro` alone. That route sees an `UploadKind`
(`"file"` / `"image"`) and never the item type slug, so a free type in that group
would force the payload to start carrying the slug just so the route could
branch. Comment the line: if a free type ever gains an upload, this breaks first,
and it breaks permissively.

Note books shipped as a free, creatable type, so unlike files and images this
takes an existing capability away. Adding the slug also puts a `PRO` badge on
Books immediately, since the sidebar renders straight from that set.

### The race

Two creates in flight can both read 49 and both write, taking a free account to
51. Postgres has no cheap constraint for this and one over the cap is not worth a
transaction. Say so in a comment rather than leaving the next reader to wonder.

## Notes

### Order matters

Follow plan §8 steps 6–15. In particular: build and verify the **webhook before
any UI exists**, driven by `stripe trigger` alone. It is the hardest part and the
only part that is easier to debug in isolation. Then the actions, then the card,
then the gates.

### The gates are the destructive step

Everything before them is additive. The demo account holds 18 items across 5
collections — under the item cap but **over the 3-collection cap** — so the
moment collections are gated, demo cannot create another one. That is correct and
will still look like a bug the first time you hit it. Either mark demo
`isPro: true` in the seed or expect it. Test the gates with a throwaway account.

### Client-side rules

- The card must `.catch(() => null)` both actions. A failed *write* answers
  `{ success: false }`, but a failed *request* **rejects** — three history
  entries record forms permanently stuck on exactly this
- Navigate to Stripe with `window.location.assign`, not `router.push` — the
  destination is not this app
- Toast the failure; there is nothing to render on success, the browser leaves

### Data the card cannot show

With only a boolean `isPro`, the card cannot say which plan the account is on,
when it renews, or that a payment failed. Adding `subscriptionStatus`,
`stripePriceId` or `currentPeriodEnd` is a migration and is out of scope — see
plan §5.12 if the copy feels thin.

## Testing

### Unit (`npm test`) — `src/actions/billing.test.ts`

Mock `@/auth`, `@/lib/prisma` and `@/lib/stripe`; `vi.stubEnv` for the price ids.
`restoreMocks` only restores `vi.spyOn` spies, so `vi.clearAllMocks()` in
`beforeEach` is what makes the "not called" assertions mean anything.

- Signed out returns the standard message and touches neither Stripe nor Prisma
- An account already on Pro is refused
- An unconfigured price fails without calling Stripe
- The customer is created once and reused on a second call
- The session URL is returned
- `openBillingPortal` refuses an account with no `stripeCustomerId`
- Gates: `createItem` refused at the cap and allowed for Pro; refused for a Pro
  type when free; `createCollection` the same

Mutation-check: deleting the `user.isPro` early return in `startCheckout` should
fail exactly one test.

### Manual — requires `stripe listen`

Against the Neon **development** branch, with
`stripe listen --forward-to localhost:3000/api/webhooks/stripe` running and its
`whsec_…` in `.env`. Without that secret the handler refuses every delivery by
design, so no checkout proves anything — `isPro` is only ever written by the
webhook.

Test cards, all with **any** future expiry, **any** 3-digit CVC and **any**
5-digit ZIP:

| Card | Outcome |
|---|---|
| `4242 4242 4242 4242` | Visa, payment succeeds |
| `4000 0000 0000 0002` | Generic decline |

Never a real card, and never against `demo@devstash.io` — use a throwaway
account, which is also what the gating section needs.

**Happy path**
- [ ] Free account sees the Free card and an Upgrade button
- [ ] Monthly checkout shows $8.00/month; yearly shows $72.00/year
- [ ] Paying returns to `/settings?checkout=success`
- [ ] `checkout.session.completed` and `customer.subscription.created` both 200
- [ ] Row has `isPro: true`, a `stripeCustomerId` and a `stripeSubscriptionId`
- [ ] **A plain reload shows Pro** — no sign-out. This proves the Phase 1
      decision to read the row rather than the token

**Declined payment** — the negative path, and the one most likely to be skipped
- [ ] `4000 0000 0000 0002` is refused on Stripe's page and the account is not
      charged
- [ ] The account is still Free afterwards: `isPro` false, no
      `stripeSubscriptionId`, and no entitling webhook delivered
- [ ] It can then pay with `4242 4242 4242 4242` and reach Pro — a failed
      attempt must not leave anything behind that blocks the next one

**Portal and lifecycle**
- [ ] Manage billing opens the portal and returns to `/settings`
- [ ] Cancelling immediately clears `isPro` and `stripeSubscriptionId`
- [ ] The account can then subscribe again — this is what clearing the unique
      column buys, so actually do it
- [ ] Cancel-at-period-end keeps Pro while the subscription is still `active`

**Gating**
- [ ] Free account refused at 50 items and at 3 collections
- [ ] `POST /api/upload` returns 403 for a free account — curl it, the UI may
      never let you try
- [ ] Dropping several files as a free account stops the batch on the first
      refusal rather than erroring per file
- [ ] Books shows a `PRO` badge and cannot be created by a free account
- [ ] A Pro account passes all of the above
- [ ] Downgrading with 60 items keeps them readable and editable; nothing is
      hidden or deleted

**Webhook security** — the part worth being thorough about
- [ ] No signature → 400
- [ ] A body altered after signing → 400
- [ ] `stripe trigger customer.subscription.deleted` twice → both 200, final
      state identical
- [ ] `STRIPE_WEBHOOK_SECRET` unset → refuses, never processes
- [ ] The route is absent from the proxy matcher and an unauthenticated POST is
      not redirected

**Regression**
- [ ] Demo signs in and renders its items and collections
- [ ] No new console errors on `/settings`, `/dashboard`, `/`

## References

- @docs/stripe-integration-plan.md — code for every file, dashboard setup (§6),
  full checklist (§7), ordered steps (§8)
- @context/features/stripe-phase-1-spec.md — the modules this builds on
- `src/components/settings/settings-upload.tsx` — the settings-card idiom
- `src/app/api/upload/route.ts` — the route-handler idiom and where the gate goes
