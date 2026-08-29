import Stripe from "stripe";

import type { BillingPlan } from "@/types/billing";

/**
 * The Stripe client, created once per process like the other third-party
 * singletons. The key is read lazily rather than at module load, for the reason
 * `getResend()` is lazy: importing this file must not crash a build or a request
 * that never talks to Stripe.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();

    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Pinned rather than left to the account default: Stripe changes response
    // shapes between versions, and a dashboard setting should not decide what
    // this code receives. The SDK's types accept only the version it ships
    // against, so a stale pin is a build error rather than a runtime surprise.
    client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  }

  return client;
}

/**
 * The price a plan is sold at, or `undefined` when the environment names none.
 *
 * Undefined rather than a throw because the caller has somewhere better to put
 * it: a checkout that cannot resolve a price answers the visitor, where a
 * webhook that cannot verify a signature must refuse outright — see
 * `webhookSecret`.
 */
export function priceIdFor(plan: BillingPlan): string | undefined {
  const value =
    plan === "yearly"
      ? process.env.STRIPE_PRICE_ID_YEARLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;

  return value?.trim() || undefined;
}

/**
 * The webhook signing secret.
 *
 * Throws rather than returning undefined, and that is deliberate: a handler
 * that cannot verify a signature must refuse the request, not process it, and
 * making the absence a throw keeps that refusal from being forgotten. It fails
 * *closed* where `rateLimit` fails open on missing Upstash config — an
 * unguarded rate limit is a nuisance, an unverified webhook is a request from
 * anyone claiming to be Stripe, claiming that an account is now Pro.
 */
export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  return secret;
}
