# Stripe Subscription Integration Plan

> DevStash Pro — $8/month, $72/year. Research pass over the codebase as it
> stands on 2026-08-29, followed by a complete implementation plan.
>
> This document is **research and planning only**. Nothing in `src/` was changed
> to produce it.

---

## 0. Two findings to read before anything else

*Both are now resolved — §0.1 by a design decision, §0.2 by the keys having been
cleared. Kept in place because each one explains why the plan below is shaped as
it is.*

### 0.1 The JWT workaround in the research prompt is not needed here

The prompt proposes changing the `jwt` callback in `src/auth.ts` to query the
database on every session validation, so a webhook's `isPro` update reaches the
client session. **Do not do this.** The premise does not hold in this codebase:

- `useSession()` appears **nowhere** in `src/`, and there is no
  `SessionProvider` mounted anywhere. The only match is a doc comment in
  `src/types/next-auth.d.ts`. Nothing in the app reads Pro status from a client
  session, so there is no client session to keep in sync.
- Every server component and server action already resolves the account through
  `getCurrentUser()` in [src/lib/db/user.ts](../src/lib/db/user.ts), which
  **reads the row on every request** and is wrapped in React's `cache()`. Adding
  `isPro` to its `select` costs nothing — the query is already being made, and
  the layout plus every dashboard section share one call.
- The session token is deliberately kept thin. It carries `id` and `pwf` (the
  password fingerprint that invalidates sessions after a password change), and
  the module comment on `getCurrentUser` explains why the row rather than the
  token is the source of truth for anything that can change: *"the session
  already carries a name and an image, but they are whatever the JWT was minted
  with."* `isPro` is exactly that kind of value.

Putting `isPro` on the token would add a query per session validation **and**
give the app a second, staler source of truth for the same fact. The plan below
puts `isPro` on `CurrentUser` instead. A page reload after checkout picks up the
new status because the row is re-read, not because the token was refreshed.

If a client component ever genuinely needs Pro status, pass it down as a prop
from a server component — the pattern `SettingsUpload` already uses for
`uploadPreferences`.

### 0.2 The Stripe keys that were in `.env.example` — resolved

A working-tree change to the **tracked** [.env.example](../.env.example) had
briefly carried a real `sk_test_…` secret key, its publishable key and both
price ids, where every other secret in that file is an empty placeholder. They
have since been cleared, in `.env.production` as well; `git grep` for
`sk_test_` / `pk_test_` across tracked files now returns nothing, and the entries
are `""`.

**No history to purge.** The values only ever existed as an uncommitted
modification — `HEAD` never held them — so there is nothing to rewrite and
nothing was pushed. Rolling the secret key in the Stripe dashboard is still the
cheap and prudent move, since it was on screen, but it is no longer urgent.

**What this leaves to do:** the app still needs those values *somewhere*.
`.env.example` is documentation and must stay empty; the real ones go in
`.env` for local work (gitignored, and what `prisma.config.ts` loads), and in
the **host environment** for a deployment. Note `.env.production` is gitignored
and is not a substitute for host configuration — the email-verification history
entry records the same trap for `DIRECT_URL`. Nothing is broken by them being
absent today, because no code reads them yet; the first thing that will fail is
step 4 of §8.

`STRIPE_PUBLISHABLE_KEY` is worth a second look before you fill it in: this plan
redirects to a hosted Checkout Session and never loads Stripe.js, so **nothing
reads it**. Either drop the entry or comment it as reserved — an unused variable
in `.env.example` reads as a missing integration to the next person.

---

## 1. Current state

### 1.1 Schema — everything needed is already there

`model User` in [prisma/schema.prisma](../prisma/schema.prisma) has carried the
three billing columns since the initial migration `20260814120000_init`, and
**nothing in the app has ever read or written any of them**:

```prisma
isPro                Boolean @default(false)
stripeCustomerId     String? @unique
stripeSubscriptionId String? @unique
```

A codebase-wide grep for `stripe` / `isPro` returns only
`src/generated/prisma/**` (generated client types) and one unrelated local
variable in `src/components/layout/sidebar.tsx:66`. There is no existing
payment, subscription, or billing code of any kind.

**Consequence: the core of this feature needs no migration.** The one optional
migration is discussed in §5.7 (a `stripePriceId` / `subscriptionStatus` column,
if you want richer state than a boolean).

### 1.2 Auth and session handling

The config is split for edge compatibility, and the split matters for where
Stripe code may live:

| File | Runtime | Contents |
|---|---|---|
| [src/auth.config.ts](../src/auth.config.ts) | edge-safe | providers only, `pages`, `SIGN_IN_PATH`, `DEFAULT_SIGN_IN_REDIRECT`. **No Prisma.** |
| [src/auth.ts](../src/auth.ts) | Node | spreads the above, adds `PrismaAdapter`, `session: { strategy: "jwt" }`, the `jwt`/`session` callbacks |
| [src/proxy.ts](../src/proxy.ts) | edge | `NextAuth(authConfig)` — verifies the JWT, redirects anonymous requests |

The `jwt` callback carries `id` and `pwf` onto the token; `session` hands both to
`session.user`. Types are augmented in
[src/types/next-auth.d.ts](../src/types/next-auth.d.ts) — note the comment
recording that `next-auth/jwt` cannot be augmented and `@auth/core/jwt` is the
real module.

**Nothing in this file needs to change for Stripe.**

### 1.3 How user data is accessed

One function, `getCurrentUser()` in [src/lib/db/user.ts](../src/lib/db/user.ts),
is the single entry point:

```ts
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id, name, email, image, createdAt, passwordHash,
              editorPreferences, uploadPreferences },
  });
  …
  if (passwordFingerprint(passwordHash) !== (session.user.pwf ?? null)) return null;
  …
});
```

Two things about it shape the plan:

1. **`CurrentUser` is a curated shape, not a Prisma row.** `passwordHash` is
   deliberately reduced to a `hasPassword` boolean so the hash "has no business
   leaving this module." Pro status follows the same convention: expose exactly
   what callers ask, nothing more.
2. **`getCurrentUserId()` derives from it**, so both paths get the new field for
   free and no call site gains a query.

The upload route already demonstrates the pattern this plan reuses — it reads
the *whole* user rather than the id, with the comment: *"the account's own limit
is on it, and `getCurrentUser` is `cache`d, so this is the same one query either
way."*

### 1.4 Prisma client

[src/lib/prisma.ts](../src/lib/prisma.ts) is a singleton over the Neon driver
adapter, and it **throws at import time when `DATABASE_URL` is unset**. Any
module importing it is therefore server-only and untestable without a mock —
which is why every test that touches `lib/db/` calls `vi.mock("@/lib/prisma")`.
The same will apply to `src/lib/stripe.ts`.

---

## 2. Feature gating analysis

### 2.1 The limits, and where they are written down today

Project overview §8 sets the free tier at **50 items / 3 collections**, plus
File/Image types, AI, export and priority support as Pro-only. Those numbers
currently exist in exactly one place in the code, and it is *marketing copy*:

- [src/components/marketing/pricing-cards.tsx](../src/components/marketing/pricing-cards.tsx)
  — `const FREE = ["50 items", "3 collections", …]` as display strings.

Nothing enforces them. Project overview §10 still lists "hard block vs. soft
warning UX" as an open decision.

### 2.2 Where a count check would go

Both create paths are server actions with an identical shape — session → schema
→ ownership checks → row write — and both have an obvious insertion point
immediately after the session check:

| Path | Action | Query module |
|---|---|---|
| Items | `createItem` in [src/actions/items.ts](../src/actions/items.ts) | `createItem` in `src/lib/db/items.ts` |
| Collections | `createCollection` in [src/actions/collections.ts](../src/actions/collections.ts) | `createCollection` in `src/lib/db/collections.ts` |

The counting queries already exist and can be reused rather than written:

- `getItemStats(userId)` in `src/lib/db/items.ts` → `{ total, favorites }`, two
  `prisma.item.count` calls.
- `getCollectionStats(userId)` in `src/lib/db/collections.ts` → derives
  `total` from the `cache()`d `getCollections(userId)` read the sidebar already
  makes, so on most requests it is free.

For the gate itself, a single `prisma.item.count({ where: { userId } })` is
cheaper than `getItemStats` (which also counts favorites), so §5.5 adds a
dedicated `countItems`.

**Two bypass routes must be covered or the gate is decorative:**

1. **`POST /api/upload`** authorises an upload *before* any item exists. A free
   account at the item cap could still burn upload authorisations and orphan
   R2 objects. The Pro check for file/image types belongs here as well as in
   `createItem`.
2. **The bulk drop zone** (`src/components/items/item-drop-zone.tsx` →
   `src/lib/upload-file.ts`) loops `POST /api/upload` then `createItem` per
   file. It already handles a 429 by stopping the batch
   (`UploadRateLimitedError`); a Pro refusal needs the same treatment or a
   free account dropping 20 files gets 20 identical errors.

### 2.3 Pro-only features — what exists to gate

| Pro feature | Status | Gate point |
|---|---|---|
| File uploads | Built | `POST /api/upload` + `createItem` (`uploadKindFor(slug) === "file"`) |
| Image uploads | Built | same, `=== "image"` |
| Books | Built, uses the image upload path | `POST /api/upload` + `createItem` — **Pro**, see below |
| AI auto-tag / summarise / explain / optimise | **Not built.** No `lib/openai.ts`, no `api/ai/*` | n/a |
| Data export | **Not built.** No `api/export` | n/a |
| Custom item types | Post-launch by design; `ItemType.userId` is modelled for it | n/a |
| Priority support | Not a code concern | n/a |

`PRO_TYPE_SLUGS` in
[src/constants/item-types.ts](../src/constants/item-types.ts) is already the
declared source of truth, and its comment states the current position exactly:

```ts
/**
 * `ItemType.slug`s reserved for Pro accounts. Labelled only — nothing is gated
 * while all users get full access during development.
 */
export const PRO_TYPE_SLUGS = new Set(["files", "images"]);
```

It drives the `PRO` badge in the sidebar and nothing else.

> **Decided: `books` is a Pro type.** It joins `files` and `images` in
> `PRO_TYPE_SLUGS`.
>
> A book stores a cover through the image upload path (`upload: "image"` in
> `CREATABLE_TYPES`), so it consumes exactly the storage that justifies gating
> images in the first place — the book-type history entry flags the omission as
> left open, and this closes it.
>
> It also makes the three Pro slugs and the set of types that hold an upload the
> **same set**, which is what keeps the gate simple: `POST /api/upload` sees an
> `UploadKind` (`"file"` / `"image"`) and not the item type slug, so a free
> `books` type would have forced the upload payload to start carrying the slug
> just so the route could tell a free book cover from a Pro image. With books
> Pro, the route's check stays a blanket `!user.isPro` and
> `uploadKindFor(slug) !== undefined` and `isProType(slug)` agree on every type.
>
> **The consequence to be deliberate about:** books are already shipped and
> creatable by everyone, and no account is Pro today. Gating them takes an
> existing free capability away, which is not true of files and images — those
> have carried a `PRO` badge since before they could be created. Existing books
> stay readable, editable and deletable; only *creating* one is gated. See the
> note on step 11 in §8.

### 2.4 Settings page structure

[src/app/settings/page.tsx](../src/app/settings/page.tsx) is a server component
that awaits `getCurrentUser()`, redirects to `SIGN_IN_PATH` when it returns
null, and renders three cards:

```tsx
<SettingsAccount user={user} />
<SettingsEditor />
<SettingsUpload preferences={user.uploadPreferences} />
```

A billing card slots straight in as a fourth. The card idiom is well
established in
[src/components/settings/settings-upload.tsx](../src/components/settings/settings-upload.tsx):
`<section className="settings-card">` wrapping `.settings-row` blocks, each with
`.settings-row-text` (an `h2`/`Label` plus `.settings-row-description`) on the
left and the control on the right. `.settings-row[data-danger]` draws the
hairline that sets the destructive row apart.

`/settings` and `/settings/:path*` are already in the proxy matcher.

---

## 3. API, action and environment patterns to follow

### 3.1 API route vs. server action

coding-standards.md carves out API routes for *webhooks*, uploads with progress,
specific status codes and third-party integrations. Everything else is a server
action. The existing split confirms it:

- Routes: `api/auth/*`, `api/upload` (progress), `api/items/[id]` (client
  `fetch` read), `api/collections` (client `fetch` read), `api/search`.
- Actions: every mutation the app makes from a form.

**For Stripe that means:** the webhook is a route (it must be, it is a webhook);
checkout and billing-portal session creation are **server actions**, matching
how every other authenticated mutation in this app works.

### 3.2 The route-handler idiom

From `api/collections/route.ts` and `api/upload/route.ts`:

```ts
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  …
}
```

Auth checks live **in the handler, not the proxy** — the comment in
`api/collections/route.ts` records why: *"the proxy answers an unauthenticated
request with a redirect to the sign-in page, which is right for a navigation and
useless to a `fetch` — it would arrive as an opaque 200 of HTML."*

**The Stripe webhook is not authenticated by session at all** and must likewise
stay out of the proxy matcher. Its authentication is the signature.

### 3.3 The server-action idiom

From `src/actions/upload-preferences.ts` and `src/actions/collections.ts`:

```ts
"use server";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const FAILED = "Could not … Try again.";

export async function doThing(input: unknown): Promise<DoThingResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { success: false, error: SIGNED_OUT };

  const parsed = someSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  try { … } catch (error) {
    console.error("doThing failed", error);
    return { success: false, error: FAILED };
  }
}
```

Rules the codebase holds to, all of which apply to the Stripe actions:

- Result type is a **discriminated union** in `src/types/*.ts`, never a bare
  object — `{ success: true; data: T } | { success: false; error: string }`.
- A `"use server"` module **may only export async functions**. Constants and
  types go in `src/types/`. (This was learned the hard way — see the auth phase
  3 history entry.)
- The owner comes from the session, **never from the payload**.
- Callers must `.catch(() => null)` the action: a failed *write* answers
  `{ success: false }`, but a failed *request* **rejects**. Three separate
  history entries record forms permanently stuck because of a missing catch.

### 3.4 Environment variables

Two established shapes, and Stripe needs both:

- **Fail-closed in production**, per `appOrigin()` in
  [src/lib/app-url.ts](../src/lib/app-url.ts): throw when unset and
  `NODE_ENV === "production"`, fall back only in development.
- **Read per call, not at module load**, per `isEmailVerificationEnabled()` in
  [src/lib/feature-flags.ts](../src/lib/feature-flags.ts), *"so the value is the
  running environment's and not the build's."*

Note the standing tension the rate-limiting history entry records: `rateLimit`
fails **open** on missing Upstash config, and the review at the time recommended
matching `appOrigin`'s throw-in-production instead. For Stripe, **fail closed** —
an unconfigured `STRIPE_WEBHOOK_SECRET` that silently accepts unsigned webhooks
is a direct path to free Pro accounts.

---

## 4. Files to create

### 4.1 `src/lib/stripe.ts` — the client singleton

Mirrors `src/lib/r2.ts` / `src/lib/resend.ts`: lazily constructed, throws with a
useful message when unconfigured.

```ts
import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * The Stripe client, constructed on first use.
 *
 * Lazy rather than module-level so importing this file does not require the key
 * — the same reason `getResend()` is lazy. The API version is pinned: Stripe
 * changes response shapes between versions, and letting the account default
 * decide means a dashboard setting can change what this code receives.
 */
export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  client = new Stripe(key, { apiVersion: "2026-08-27.clover" });

  return client;
}

/** The price a plan maps to, or undefined when the environment names none. */
export function priceIdFor(plan: BillingPlan): string | undefined {
  const value =
    plan === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;

  return value?.trim() || undefined;
}

/**
 * The webhook signing secret. Throws rather than returning undefined: a webhook
 * handler that cannot verify a signature must refuse the request, not process
 * it, and making that a throw keeps the refusal from being forgotten.
 */
export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set.");
  }

  return secret;
}
```

> Pin `apiVersion` to whatever the installed `stripe` package's types expect —
> the value above is illustrative. Mismatching it is a TypeScript error, which
> is the good failure mode.

### 4.2 `src/types/billing.ts` — plans and result shapes

Constants and types must live outside the `"use server"` module.

```ts
/** The two subscription cadences the pricing page offers. */
export const BILLING_PLANS = ["monthly", "yearly"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

/**
 * What `startCheckout` answers with. The successful half carries the Stripe
 * URL the browser is sent to; there is nothing to render on success.
 */
export type StartCheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

/** What `openBillingPortal` answers with. Same shape, same reason. */
export type BillingPortalResult =
  | { success: true; url: string }
  | { success: false; error: string };
```

### 4.3 `src/lib/validations/billing.ts` — the plan schema

```ts
import { z } from "zod";

import { BILLING_PLANS } from "@/types/billing";

/**
 * What `startCheckout` accepts. An enum rather than a price id: the price the
 * plan maps to is the environment's to decide, so a request can name which plan
 * it wants but not what it costs.
 */
export const startCheckoutSchema = z.object({
  plan: z.enum(BILLING_PLANS),
});
```

This is the same reasoning `createItem` uses for `typeSlug` over `itemTypeId`,
and `saveUploadPreferences` uses for its fixed offered set: **the client names a
choice, the server resolves it to a value.** A raw `price_…` in the payload
would let a caller subscribe themselves to any price in the account, including a
$0 one.

### 4.4 `src/lib/db/billing.ts` — the row writes

Kept out of `src/lib/db/user.ts` so the webhook's writes are not mixed in with
the session read.

```ts
import { prisma } from "@/lib/prisma";

/**
 * The Stripe customer this account belongs to, creating one if it has none.
 *
 * Reads before writing rather than upserting, because the customer is created
 * at Stripe first and the id has to come back before there is anything to
 * store.
 */
export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  return user?.stripeCustomerId ?? null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });
}

/**
 * Applies a subscription's state to the account behind a Stripe customer.
 *
 * Keyed on `stripeCustomerId` rather than on a user id from the webhook
 * payload: the payload is Stripe's, and the customer id is the only field in it
 * this app has itself stored. `updateMany` rather than `update` so a customer
 * with no matching row — a test-mode event replayed against production, say —
 * is a no-op rather than a P2025 throw that fails the webhook and makes Stripe
 * retry forever.
 */
export async function applySubscriptionState(
  customerId: string,
  state: { isPro: boolean; subscriptionId: string | null },
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      isPro: state.isPro,
      stripeSubscriptionId: state.subscriptionId,
    },
  });

  return count > 0;
}
```

### 4.5 `src/actions/billing.ts` — checkout and portal

```ts
"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/db/user";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/db/billing";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { appOrigin } from "@/lib/app-url";
import { firstIssueMessage } from "@/lib/validations/auth";
import { startCheckoutSchema } from "@/lib/validations/billing";
import type { BillingPortalResult, StartCheckoutResult } from "@/types/billing";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const CHECKOUT_FAILED = "Could not start checkout. Try again.";
const PORTAL_FAILED = "Could not open billing. Try again.";
const NO_SUBSCRIPTION = "You do not have a subscription to manage.";

/**
 * Creates a Stripe Checkout session and answers with the URL to send the
 * browser to.
 *
 * The account comes from the session and the price from the environment, so a
 * request names only which of the two plans it wants — it cannot name a price,
 * a customer, or an amount.
 */
export async function startCheckout(input: unknown): Promise<StartCheckoutResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: SIGNED_OUT };

  // Nothing to buy: the account already has what checkout would sell it.
  if (user.isPro) {
    return { success: false, error: "You are already on Pro." };
  }

  const parsed = startCheckoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: firstIssueMessage(parsed.error) };

  const price = priceIdFor(parsed.data.plan);
  if (!price) {
    console.error("startCheckout: no price configured for", parsed.data.plan);
    return { success: false, error: CHECKOUT_FAILED };
  }

  try {
    const stripe = getStripe();
    const origin = billingOrigin();

    // Reused when the account has one, so a returning subscriber keeps one
    // customer record and one billing history rather than accumulating them.
    let customerId = await getStripeCustomerId(user.id);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        // The link back. The webhook keys on `stripeCustomerId` rather than
        // this, but it is what makes a Stripe dashboard row traceable to a row
        // here when something needs investigating by hand.
        metadata: { userId: user.id },
      });

      customerId = customer.id;
      await setStripeCustomerId(user.id, customerId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/settings?checkout=success`,
      cancel_url: `${origin}/settings?checkout=cancelled`,
      // Carried onto the subscription so a `customer.subscription.*` event can
      // be traced without a second API call.
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      console.error("startCheckout: session created with no url", session.id);
      return { success: false, error: CHECKOUT_FAILED };
    }

    return { success: true, url: session.url };
  } catch (error) {
    console.error("startCheckout failed", error);
    return { success: false, error: CHECKOUT_FAILED };
  }
}

/** Opens the Stripe customer portal, where a subscription is changed or cancelled. */
export async function openBillingPortal(): Promise<BillingPortalResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: SIGNED_OUT };

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) return { success: false, error: NO_SUBSCRIPTION };

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${billingOrigin()}/settings`,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error("openBillingPortal failed", error);
    return { success: false, error: PORTAL_FAILED };
  }
}
```

> **`appOrigin()` takes a `Request`,** which a server action does not have. Two
> options, and the second is recommended:
>
> 1. Read `headers()` from `next/headers` and build a `Request`-like origin.
> 2. **Add a no-argument `configuredOrigin()` to
>    [src/lib/app-url.ts](../src/lib/app-url.ts)** that returns `APP_URL` and
>    throws when unset, with no request fallback at all. Stripe's `success_url`
>    and `return_url` must be absolute and must not be derived from a
>    caller-supplied `Host` — the exact attack `appOrigin` was written to
>    prevent. `billingOrigin()` above is that function.

### 4.6 `src/app/api/stripe/webhook/route.ts` — the webhook

This is the security boundary of the whole feature.

```ts
import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { applySubscriptionState } from "@/lib/db/billing";
import { getStripe, webhookSecret } from "@/lib/stripe";

// Reads the raw body and verifies a signature over it; nothing here is cacheable.
export const dynamic = "force-dynamic";

/**
 * The events that change an account's Pro status. Anything else is acknowledged
 * and ignored — Stripe retries a non-2xx, so answering 200 to an event we do
 * not act on is what stops it retrying forever.
 */
const HANDLED = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Statuses that entitle an account to Pro. */
const ACTIVE = new Set(["active", "trialing"]);

/**
 * Stripe's subscription webhook.
 *
 * There is no session here and there must not be: Stripe is the caller. The
 * signature over the raw body is the authentication, which is why the body is
 * read with `request.text()` — `request.json()` would reparse and reserialize
 * it, and the bytes would no longer be the bytes that were signed.
 *
 * Deliberately outside the proxy's matcher, like every other route under
 * `api/`: the proxy would answer an unauthenticated request with a redirect,
 * and Stripe would read that as a delivery failure and retry.
 *
 * `constructEventAsync` rather than `constructEvent` — the async form uses
 * SubtleCrypto and is what Stripe documents for Next.js route handlers.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();

    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret(),
    );
  } catch (error) {
    // A bad signature and a missing secret both land here. Neither is safe to
    // process, and 400 tells Stripe not to bother retrying a forged request.
    console.error("stripe webhook verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    await apply(event);
  } catch (error) {
    // A 500 asks Stripe to retry, which is right for a transient database
    // failure — the events are idempotent, so a replay costs nothing.
    console.error("stripe webhook handling failed", event.type, error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function apply(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // A session can complete without the subscription being live yet, so the
    // subscription is re-read rather than assumed. `customer.subscription.*`
    // would arrive anyway; handling this event too is what makes the settings
    // page correct on the first reload after checkout.
    if (!session.subscription || !session.customer) return;

    const subscription = await stripe.subscriptions.retrieve(
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id,
    );

    await write(subscription);
    return;
  }

  await write(event.data.object as Stripe.Subscription);
}

async function write(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const isPro = ACTIVE.has(subscription.status);

  // The subscription id is kept while it entitles Pro and cleared when it does
  // not, so the column means "the subscription paying for this account" rather
  // than "the last one we saw" — `stripeSubscriptionId` is `@unique`, and a
  // cancelled id left behind would block a re-subscribe.
  await applySubscriptionState(customerId, {
    isPro,
    subscriptionId: isPro ? subscription.id : null,
  });
}
```

**Idempotency note.** Stripe delivers at least once and events can arrive out of
order. The handler above is idempotent by construction — it writes an absolute
state derived from the subscription, never a delta — which is why no
`processedEvents` table is needed. Out-of-order delivery is the remaining risk:
a stale `updated` landing after a `deleted` would resurrect Pro. If that matters,
add a `subscriptionUpdatedAt` column and refuse writes older than the stored
timestamp (§5.7).

### 4.7 `src/components/settings/settings-billing.tsx` — the card

Follows `settings-upload.tsx` exactly: `"use client"`, `useTransition`, the
`.catch(() => null)`, `toast.error` on failure.

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal, startCheckout } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import type { BillingPlan } from "@/types/billing";

const UNREACHABLE = "Could not reach the server. Try again.";

interface SettingsBillingProps {
  isPro: boolean;
  /** Whether the account has a Stripe customer, so the portal has something to open. */
  hasSubscription: boolean;
}

export function SettingsBilling({ isPro, hasSubscription }: SettingsBillingProps) {
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  const [busy, startBusy] = useTransition();

  function go(run: () => Promise<{ success: boolean; url?: string; error?: string }>) {
    startBusy(async () => {
      // The action answers a failed call with `{ success: false }`, but a failed
      // *request* rejects — without this the button stays dead and says nothing.
      const result = await run().catch(() => null);

      if (!result?.success || !result.url) {
        toast.error(result?.error ?? UNREACHABLE);
        return;
      }

      // A full navigation, not `router.push`: the destination is Stripe's.
      window.location.assign(result.url);
    });
  }

  return (
    <section className="settings-card" aria-busy={busy}>
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Plan</h2>
          <p className="settings-row-description">
            {isPro
              ? "You are on Pro. Manage or cancel your subscription in the billing portal."
              : "Free — 50 items and 3 collections. Upgrade for unlimited everything, file and image uploads, and export."}
          </p>
        </div>
      </div>

      {/* plan picker + Upgrade, or Manage billing when isPro */}
    </section>
  );
}
```

### 4.8 Tests

The suite is at **373 passing**, and `vitest.config.mts` collects only
`src/lib/**/*.test.ts` and `src/actions/**/*.test.ts`. Route handlers and
components are uncollectable by configuration, so the webhook and the card
cannot be unit-tested — plan for that rather than being surprised by it.

| File | Covers |
|---|---|
| `src/lib/validations/billing.test.ts` | the plan enum accepts both plans and refuses a raw `price_…` |
| `src/actions/billing.test.ts` | signed out; already-Pro refusal; an unconfigured price failing without calling Stripe; the customer being created once and reused; the returned URL |

Mock `@/auth`, `@/lib/prisma` and `@/lib/stripe`, and use `vi.stubEnv` for the
price ids — Vitest loads no `.env`. Remember `restoreMocks` only restores
`vi.spyOn` spies, so `vi.clearAllMocks()` in `beforeEach` is what makes
"not called" assertions mean anything.

**Mutation-check the two rules that matter** (the house practice): deleting the
`user.isPro` early return should fail exactly one test, and swapping
`startCheckoutSchema`'s enum for `z.string()` should fail exactly one.

---

## 5. Files to modify

### 5.1 `src/lib/db/user.ts` — put `isPro` on `CurrentUser`

The whole of the session-sync problem, solved in five lines.

```diff
 export interface CurrentUser {
   id: string;
   …
   hasPassword: boolean;
+  /**
+   * Whether the account is on Pro. Read from the row rather than the session
+   * token for the reason `name` and `image` are: the token is whatever it was
+   * minted with, and a Stripe webhook changes this behind the visitor's back.
+   * A reload after checkout is enough because this query runs on every request.
+   */
+  isPro: boolean;
+  /** Whether the account has a Stripe customer, so the portal has something to open. */
+  hasBilling: boolean;
   editorPreferences: EditorPreferences;
   uploadPreferences: UploadPreferences;
 }
```

and in the `select`:

```diff
       passwordHash: true,
+      isPro: true,
+      stripeCustomerId: true,
       editorPreferences: true,
```

Destructure `stripeCustomerId` out alongside `passwordHash` and expose it only
as `hasBilling`, the same reduction `hasPassword` makes — a customer id has no
business in a component's props.

**Cost: zero extra queries.** Two more columns on a `findUnique` that already
runs once per request.

### 5.2 `src/constants/item-types.ts` — make the gate a function

`PRO_TYPE_SLUGS` stays as the badge's source; add the predicate the server
checks, so the two cannot drift:

```diff
-/**
- * `ItemType.slug`s reserved for Pro accounts. Labelled only — nothing is gated
- * while all users get full access during development.
- */
-export const PRO_TYPE_SLUGS = new Set(["files", "images"]);
+/**
+ * `ItemType.slug`s that require a Pro subscription — the badge the sidebar
+ * shows, and the rule the server enforces.
+ *
+ * `books` is here because a book's cover goes through the image upload path,
+ * so it costs the same storage that gates images. That also makes this set
+ * exactly the set of types holding an upload, which is what lets
+ * `POST /api/upload` check `isPro` alone: the route sees an `UploadKind` and
+ * never the slug, so a free type in this group would have to start sending one.
+ */
+export const PRO_TYPE_SLUGS = new Set(["files", "images", "books"]);
+
+/**
+ * Whether a type requires a Pro subscription.
+ *
+ * The same set the sidebar badges, now enforced. Keep the two in one place:
+ * a badge saying PRO on a type the server allows, or the reverse, is worse
+ * than either behaviour on its own.
+ */
+export function isProType(slug: string): boolean {
+  return PRO_TYPE_SLUGS.has(slug);
+}
```

Note this alone — before any gate exists — changes the UI: the sidebar renders a
`PRO` badge from this set, so Books gains one the moment the slug is added.
That is the intended end state, but it is worth landing knowingly rather than as
a side effect of a constant edit.

### 5.3 `src/lib/db/items.ts` and `collections.ts` — counts for the gate

```ts
/** How many items the account holds, for the free-tier cap. */
export const countItems = cache(
  async (userId: string): Promise<number> =>
    prisma.item.count({ where: { userId } }),
);
```

Collections need nothing new: `getCollectionStats(userId).total` derives from the
`cache()`d `getCollections` the sidebar already reads.

### 5.4 `src/constants/limits.ts` (new) — the numbers, once

```ts
/**
 * What a free account may hold, per project overview §8. Pro is unlimited, so
 * these are only ever consulted when `isPro` is false.
 *
 * Here rather than in the pricing copy so the page and the gate cannot disagree
 * — `pricing-cards.tsx` should render these rather than restating them.
 */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;
```

### 5.5 `src/actions/items.ts` — gate `createItem`

Two checks, immediately after the type is resolved:

```diff
   const creatable = creatableType(parsed.data.typeSlug);
   if (!creatable) return { success: false, error: UNKNOWN_TYPE };
+
+  const user = await getCurrentUser();   // cache()d — the same query as above
+
+  if (!user.isPro && isProType(creatable.slug)) {
+    return { success: false, error: PRO_TYPE_REQUIRED };
+  }
+
+  if (!user.isPro && (await countItems(userId)) >= FREE_ITEM_LIMIT) {
+    return { success: false, error: ITEM_LIMIT_REACHED };
+  }
```

with

```ts
const PRO_TYPE_REQUIRED = "Files and images are a Pro feature. Upgrade in Settings.";
const ITEM_LIMIT_REACHED =
  `Free accounts can hold ${FREE_ITEM_LIMIT} items. Upgrade in Settings for unlimited.`;
```

Switch `getCurrentUserId()` for `getCurrentUser()` at the top of the action — it
is `cache()`d, so the whole row costs exactly what the id did.

> **Race note.** Two creates in flight can both read 49 and both write, taking a
> free account to 51. Postgres has no cheap constraint for this. It is the same
> class of race the codebase already accepts elsewhere (the duplicate-email
> pre-check in registration, backstopped by a unique index — there is no
> equivalent index here). One over the cap is not worth a transaction; say so in
> a comment rather than leaving the next reader to wonder.

### 5.6 `src/actions/collections.ts` — gate `createCollection`

Identical shape against `FREE_COLLECTION_LIMIT` and
`getCollectionStats(userId).total`.

### 5.7 `src/app/api/upload/route.ts` — gate the upload authorisation

The bypass from §2.2. After the user is resolved and before the rate limit:

```diff
   const user = await getCurrentUser();
   if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
+
+  // Ahead of the rate limit, because a free account should be told it needs Pro
+  // rather than told to wait. `createItem` refuses the type too — this is the
+  // earlier of the two, so a refused upload never reaches the bucket.
+  if (!user.isPro) {
+    return NextResponse.json(
+      { error: "Uploads are a Pro feature. Upgrade in Settings." },
+      { status: 403 },
+    );
+  }
```

Then teach `src/lib/upload-file.ts` to distinguish 403 the way it already
distinguishes 429 — a new `UploadNotAllowedError`, with
`item-drop-zone.tsx` stopping the batch on it. Otherwise a free account dropping
20 files collects 20 identical Pro notices.

**The blanket `!user.isPro` above is correct only because books are Pro** (§2.3).
This route sees an `UploadKind` (`"file"` / `"image"`) and never the item type
slug, so it cannot tell a book's cover from an ordinary image. Had books stayed
free, the upload payload would have needed to carry the slug and the check would
have become `isProType(slug)` — one more field the client sends and the server
has to distrust. With all three upload-holding types Pro, the route needs
neither.

If a free type ever gains an upload, this is the line that breaks first, and it
breaks silently in the permissive direction. Worth a comment saying so.

### 5.8 `src/app/settings/page.tsx` — render the card

```diff
       <SettingsAccount user={user} />
+      <SettingsBilling isPro={user.isPro} hasSubscription={user.hasBilling} />
       <SettingsEditor />
       <SettingsUpload preferences={user.uploadPreferences} />
```

Place it second — the plan is the thing most likely to be looked for, and the
Account card's `[data-danger]` delete row should stay last on the page.

Optionally read `?checkout=success` from `searchParams` and render a notice, the
`?reset=1` pattern `sign-in/page.tsx` already uses.

### 5.9 `src/proxy.ts` — leave it alone

`/api/stripe/webhook` is not in the matcher and must not be added. Worth a
comment in the webhook file (drafted in §4.6) so nobody "fixes" it later.

### 5.10 `src/components/marketing/pricing-cards.tsx` — point Go Pro somewhere real

Both CTAs currently go to `/register`, with the comment *"there is no checkout
yet."* Once there is:

- Signed out → `/register?plan=pro` (register, then land on settings).
- Signed in → `/settings` with the plan preselected, **not** straight into
  checkout. Checkout is a server action needing a session; a marketing page
  should not silently start a payment flow.

Also replace the literal `"50 items"` / `"3 collections"` strings with the
`FREE_*` constants from §5.4.

### 5.11 `.env.example` — the security fix plus the new entries

Blank the real values (§0.2) and document, in the house style — every other
entry there explains *why*:

```bash
# Stripe — https://dashboard.stripe.com/apikeys
#
# The secret key is server-only and must never reach a bundle. The publishable
# key is unused today: checkout runs entirely server-side through a redirect to
# a Checkout Session, so there is no Stripe.js on any page.
STRIPE_SECRET_KEY=

# Signing secret for POST /api/stripe/webhook. Required — the handler refuses
# every request without it, because an unverified webhook is a request from
# anyone claiming to be Stripe, and the thing it claims is that an account is
# now Pro. Get it from `stripe listen` locally, or from the endpoint's page in
# the dashboard for a deployment; the two are different values.
STRIPE_WEBHOOK_SECRET=

# The recurring prices Pro is sold at. The plan a request names is resolved to
# one of these here rather than sent by the client, so nobody can subscribe
# themselves to a price the app does not offer.
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
```

Add the same keys to `.env`, and note that `APP_URL` becomes **strictly
required** for billing — the checkout return URLs are built from it.

### 5.12 Optional schema change

The plan above needs **no migration**. Consider one if you want:

| Column | Buys you |
|---|---|
| `subscriptionStatus String?` | `past_due` / `canceled` distinguishable from "never subscribed"; a "your payment failed" banner |
| `stripePriceId String?` | which plan the account is on, shown in the card without a Stripe API call |
| `currentPeriodEnd DateTime?` | "renews on…" / "access until…" after a cancellation |
| `subscriptionUpdatedAt DateTime?` | out-of-order webhook protection (§4.6) |

If you add any, follow the house rule: `npm run db:migrate`, then **`npx prisma
generate` by hand** — two history entries record `tsc` failing on unrelated
lines because the generated client did not pick a new column up.

---

## 6. Stripe Dashboard setup

All of this in **test mode** first; the toggle is top-right.

1. **Product.** Products → *Add product* → name `DevStash Pro`.
2. **Two recurring prices** on that one product:
   - $8.00 USD, recurring, monthly → copy the `price_…` → `STRIPE_PRICE_ID_MONTHLY`
   - $72.00 USD, recurring, yearly → copy the `price_…` → `STRIPE_PRICE_ID_YEARLY`
   Two prices on one product (not two products) is what lets the customer portal
   offer a monthly↔yearly switch.
3. **API keys.** Developers → API keys → copy the secret key into `.env`.
   *(Roll the one currently in `.env.example` — see §0.2.)*
4. **Customer portal.** Settings → Billing → Customer portal → activate, and
   enable: update payment method, cancel subscription, switch plan (listing both
   prices above). Set the default return URL, though `openBillingPortal` passes
   one per session anyway.
5. **Webhook endpoint** — *deployment only; use the CLI locally.*
   Developers → Webhooks → *Add endpoint*
   - URL: `https://<your-domain>/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the signing secret → `STRIPE_WEBHOOK_SECRET` **in the deployment's
     environment**. It differs from the CLI's.
6. **Local webhooks.**
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   The `whsec_…` it prints goes in `.env`. Leave it running while testing.
7. **Optional:** Settings → Billing → Subscriptions → set retry/dunning rules and
   what happens to a subscription after failed payments.

---

## 7. Testing checklist

### Unit (`npm test`)

- [ ] `startCheckoutSchema` accepts `monthly` and `yearly`, refuses `price_123`
      and an unknown plan
- [ ] `startCheckout` returns `SIGNED_OUT` with no session, and touches neither
      Stripe nor Prisma
- [ ] `startCheckout` refuses an account already on Pro
- [ ] an unconfigured price id fails without calling Stripe
- [ ] a customer is created once and reused on the second call
- [ ] `openBillingPortal` refuses an account with no `stripeCustomerId`
- [ ] `createItem` refuses a free account at `FREE_ITEM_LIMIT`, and allows a Pro
      account past it
- [ ] `createItem` refuses a Pro type for a free account, allows it for Pro
- [ ] `createCollection` the same against `FREE_COLLECTION_LIMIT`
- [ ] mutation checks: deleting the `isPro` early return fails exactly one test;
      widening the plan enum to `z.string()` fails exactly one

### Manual, against the Neon **development** branch

Requires `stripe listen` running. Use card `4242 4242 4242 4242`, any future
expiry, any CVC.

**Happy path**
- [ ] Free account → `/settings` shows the Free card and an Upgrade button
- [ ] Upgrade (monthly) redirects to Stripe Checkout with $8.00/month
- [ ] Paying returns to `/settings?checkout=success`
- [ ] `stripe listen` shows `checkout.session.completed` and
      `customer.subscription.created`, both answered **200**
- [ ] The row has `isPro: true`, a `stripeCustomerId` and a `stripeSubscriptionId`
- [ ] **A plain reload of `/settings` shows Pro** — no sign-out needed. This is
      the check that proves §0.1: the row is re-read, the token was never touched
- [ ] Yearly checkout shows $72.00/year

**Portal and cancellation**
- [ ] Manage billing opens the portal, returns to `/settings`
- [ ] Cancelling immediately sends `customer.subscription.deleted`; the row goes
      `isPro: false` with `stripeSubscriptionId` cleared
- [ ] The account can then subscribe again — this is what the cleared unique
      column buys, so it is worth actually doing
- [ ] Cancel-at-period-end sends `updated` with the subscription still `active`,
      and Pro is **kept**

**Gating**
- [ ] A free account at 50 items is refused with the upgrade message
- [ ] It is refused at 3 collections
- [ ] `POST /api/upload` returns **403** for a free account (curl it — the UI may
      never let you try)
- [ ] Dropping several files as a free account stops the batch on the first
      refusal rather than erroring per file
- [ ] A Pro account passes all four
- [ ] Downgrading to free with 60 items **keeps** them readable and editable —
      only *creating* is capped. Confirm nothing is hidden or deleted

**Webhook security** — the part worth being thorough about
- [ ] `curl -X POST /api/stripe/webhook -d '{}'` with no signature → **400**
- [ ] A body altered after signing → **400**
- [ ] `stripe trigger customer.subscription.deleted` replayed twice → both 200,
      final state identical (idempotency)
- [ ] With `STRIPE_WEBHOOK_SECRET` unset the handler **refuses**, never processes
- [ ] The route is absent from `src/proxy.ts`'s matcher, and an unauthenticated
      POST is not redirected

**Regression**
- [ ] `npm test`, `npx tsc --noEmit`, `npx eslint src`, `npm run build` all clean
- [ ] The demo account still signs in and renders its items and collections
- [ ] No new console errors on `/settings`, `/dashboard`, `/`

---

## 8. Implementation order

Each step leaves the app building and the suite green.

| # | Step | Notes |
|---|---|---|
| 1 | ~~Clear the keys from `.env.example`~~ **done** (§0.2); add the documented comments to the empty entries | Real values go in `.env` and the host environment, never here |
| 2 | Stripe Dashboard: product, two prices, keys, portal (§6.1–6.4) | No code |
| 3 | `npm install stripe` | One dependency; check `npm audit` against the four known pre-existing highs |
| 4 | `src/lib/stripe.ts`, `src/types/billing.ts`, `src/lib/validations/billing.ts`, `configuredOrigin()` in `app-url.ts` | Pure plumbing, no behaviour change |
| 5 | `isPro` + `hasBilling` on `CurrentUser` (§5.1) | Still nothing reads them |
| 6 | `src/lib/db/billing.ts` + the webhook route (§4.4, §4.6) | Test with `stripe listen` and `stripe trigger` before any UI exists — the hardest part, verified in isolation |
| 7 | `src/actions/billing.ts` + its tests (§4.5, §4.8) | Checkout works end to end via a temporary button or a `tsx` script |
| 8 | `SettingsBilling` card + wire into `/settings` (§4.7, §5.8) | First user-visible change; full manual pass on the happy path |
| 9 | Portal, cancellation, re-subscribe | Completes the lifecycle |
| 10 | `src/constants/limits.ts` + `countItems` (§5.3, §5.4) | Numbers in one place, still unenforced |
| 11 | Gate `createItem` and `createCollection` (§5.5, §5.6) | **The first step that can lock a real user out. Test with a throwaway account, not demo** |
| 12 | Gate `POST /api/upload` + the drop-zone 403 path (§5.7) | A blanket `!user.isPro`, which works because books are Pro (§2.3) |
| 13 | `isProType` replaces the label-only comment (§5.2) | Badge and gate now share one source |
| 14 | Pricing page CTAs and the shared limit constants (§5.10) | |
| 15 | Deploy: production keys, the dashboard webhook endpoint, `APP_URL` | The endpoint secret differs from the CLI's — §6.5 |

**A note on step 11.** Every gate before it is additive; this one takes something
away. The demo account holds 18 items across 5 collections — under the item cap
but **over the 3-collection cap** — so the moment collections are gated, demo
cannot create another one. That is correct behaviour and will still look like a
bug the first time you hit it. Either mark demo `isPro: true` in the seed, or
expect it.

---

## 9. Open questions for the implementer

*Books being a Pro type is **settled** — see §2.3. The rest are still open.*

1. **Hard block or soft warning at the caps?** Project overview §10 still lists
   this as undecided. The plan implements a hard block on *create*, with existing
   content untouched — the least destructive reading.
2. **Should a downgrade do anything to stored files?** Currently nothing. An
   account that uploads 40 GB on Pro and cancels keeps it in R2 with no quota and
   no sweep. Out of scope here, but it is a real bill.
3. **Trial period?** No `trialing` flow is wired up beyond the webhook already
   treating it as entitling Pro.
4. **Do the AI and export features get built before or after this?** They are
   listed as Pro but do not exist, so `isProType` and the settings copy are
   currently promising two things the app cannot do.
