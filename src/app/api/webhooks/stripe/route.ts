import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { applySubscriptionState } from "@/lib/db/billing";
import { getStripe, webhookSecret } from "@/lib/stripe";

// Reads the raw body and verifies a signature over it; nothing here is
// cacheable, and a cached response would be a replayed one.
export const dynamic = "force-dynamic";

/**
 * The events that change an account's Pro status.
 *
 * Anything else is acknowledged and ignored. Stripe retries a non-2xx, so
 * answering 200 to an event we do not act on is what stops it retrying an
 * event we were never going to handle.
 */
const HANDLED = new Set<Stripe.Event["type"]>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/**
 * The subscription statuses that entitle an account to Pro.
 *
 * Everything else — `past_due`, `canceled`, `incomplete`, `unpaid` — does not.
 * Stated as the allow-list rather than as a list of exclusions, so a status
 * Stripe adds later withholds Pro rather than granting it.
 */
const ENTITLING = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

/**
 * Stripe's subscription webhook.
 *
 * There is no session here and there must not be: Stripe is the caller, and the
 * signature over the raw body is the authentication. That is why the body is
 * read with `request.text()` — `request.json()` would reparse and reserialize
 * it, and the bytes would no longer be the bytes that were signed.
 *
 * **Deliberately outside the proxy's matcher** (`src/proxy.ts`), like every
 * other route under `api/`. The proxy answers an unauthenticated request with a
 * redirect to the sign-in page, and Stripe reads a redirect as a failed
 * delivery. Do not "fix" this by adding the path there.
 *
 * `constructEventAsync` rather than `constructEvent` — the async form uses
 * SubtleCrypto and is what Stripe documents for Next.js route handlers.
 *
 * Idempotent by construction: every write is an absolute state derived from the
 * subscription, never a delta, so a redelivery costs nothing and no table of
 * processed event ids is needed.
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
    // A forged signature, a body altered after signing, and an unset
    // `STRIPE_WEBHOOK_SECRET` all land here — `webhookSecret` throws rather
    // than returning undefined precisely so the last one cannot be processed.
    // None is safe to act on, and 400 tells Stripe not to retry a request it
    // will never be able to make us accept.
    console.error("stripe webhook verification failed", error);

    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  try {
    await apply(event);
  } catch (error) {
    // A 500 asks Stripe to retry, which is what a transient database failure
    // wants. Safe because the handler is idempotent — a replay writes the same
    // state it would have written the first time.
    console.error("stripe webhook handling failed", event.type, error);

    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/** Turns one handled event into the subscription whose state it describes. */
async function apply(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // A one-off payment, or a session that completed without a subscription
    // attached. Nothing here to entitle.
    if (!session.subscription) {
      return;
    }

    // Re-read rather than assumed: the session says a checkout finished, not
    // what state the subscription ended up in. `customer.subscription.created`
    // would arrive anyway, but handling this event too is what makes the
    // settings page correct on the first reload after paying.
    const subscription = await getStripe().subscriptions.retrieve(
      idOf(session.subscription),
    );

    await write(subscription);

    return;
  }

  // The remaining three are all `customer.subscription.*`, whose payload is the
  // subscription itself. Switched on rather than cast: `event.data.object` is a
  // union across every event type, and a cast would keep compiling if this set
  // ever grew to include one that is not a subscription.
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await write(event.data.object);
  }
}

/** Applies one subscription's state to the account behind its customer. */
async function write(subscription: Stripe.Subscription): Promise<void> {
  const isPro = ENTITLING.has(subscription.status);

  // Keyed on the customer id, which is the only field in Stripe's payload this
  // app has itself stored — a user id in the metadata is Stripe's copy of ours
  // and would be trusting the request to name the row it updates.
  //
  // The subscription id is kept while it entitles Pro and cleared when it does
  // not, so the column means "the subscription paying for this account" rather
  // than "the last one we saw". `stripeSubscriptionId` is `@unique`, and a
  // cancelled id left behind would block the same account re-subscribing.
  await applySubscriptionState(idOf(subscription.customer), {
    isPro,
    subscriptionId: isPro ? subscription.id : null,
  });
}

/**
 * The id of a field Stripe sends either as an id or as the expanded object.
 *
 * Nothing here asks for expansion, but the types allow both and a deleted
 * customer arrives as a third shape, so this reads the id off whichever came.
 */
function idOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}
