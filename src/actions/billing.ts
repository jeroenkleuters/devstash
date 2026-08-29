"use server";

import { configuredOrigin } from "@/lib/app-url";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/db/billing";
import { getCurrentUser } from "@/lib/db/user";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { firstIssueMessage } from "@/lib/validations/auth";
import { startCheckoutSchema } from "@/lib/validations/billing";
import type { BillingPortalResult, StartCheckoutResult } from "@/types/billing";

/**
 * A session is not the same as a live account: the row can be gone while the
 * JWT still verifies, which is what `getCurrentUser` returning null means.
 */
const SIGNED_OUT = "Your session has ended. Sign in again.";

const CHECKOUT_FAILED = "Could not start checkout. Try again.";
const PORTAL_FAILED = "Could not open billing. Try again.";

/** Nothing to sell: the account already has what checkout would give it. */
const ALREADY_PRO = "You are already on Pro.";

/** No Stripe customer, so the portal has nothing to open. */
const NO_BILLING = "You do not have a subscription to manage.";

/**
 * Creates a Stripe Checkout session and answers with the URL to send the
 * browser to.
 *
 * The account comes from the session and the price from the environment, so a
 * request names only which of the two plans it wants — never a price, a
 * customer or an amount. That is the same reasoning `createItem` uses for
 * `typeSlug` over `itemTypeId`: the client names a choice, the server resolves
 * it to a value.
 *
 * There is nothing to render on success. The caller navigates away.
 */
export async function startCheckout(
  input: unknown,
): Promise<StartCheckoutResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: SIGNED_OUT };
  }

  if (user.isPro) {
    return { success: false, error: ALREADY_PRO };
  }

  const parsed = startCheckoutSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  const price = priceIdFor(parsed.data.plan);

  // An unconfigured environment, not anything the visitor did or can fix — so
  // it is logged with the plan that has no price and answered generically.
  if (!price) {
    console.error("startCheckout: no price configured for", parsed.data.plan);

    return { success: false, error: CHECKOUT_FAILED };
  }

  try {
    const stripe = getStripe();
    const origin = configuredOrigin();

    // Reused when the account already has one, so a returning subscriber keeps
    // a single customer record and one billing history rather than
    // accumulating a new customer per attempt.
    let customerId = await getStripeCustomerId(user.id);

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        // The link back. The webhook keys on `stripeCustomerId` rather than on
        // this, but it is what makes a row in the Stripe dashboard traceable
        // to a row here when something has to be investigated by hand.
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
      // be traced back without a second API call.
      subscription_data: { metadata: { userId: user.id } },
      allow_promotion_codes: true,
    });

    // Documented as optional on the response, so it is checked rather than
    // asserted — a session with nowhere to send the browser is our problem.
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

/**
 * Opens the Stripe customer portal, where a subscription is changed or
 * cancelled.
 *
 * Takes no argument: the customer is the session's, and there is nothing about
 * the portal for a request to choose. What happens in it comes back as a
 * webhook — this action never writes.
 */
export async function openBillingPortal(): Promise<BillingPortalResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: SIGNED_OUT };
  }

  const customerId = await getStripeCustomerId(user.id);

  if (!customerId) {
    return { success: false, error: NO_BILLING };
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${configuredOrigin()}/settings`,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error("openBillingPortal failed", error);

    return { success: false, error: PORTAL_FAILED };
  }
}
