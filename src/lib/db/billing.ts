import { prisma } from "@/lib/prisma";

/**
 * The billing writes, kept out of `src/lib/db/user.ts` so the webhook's
 * mutations are not mixed in with the session read every request makes.
 */

/**
 * The Stripe customer this account belongs to, or `null` when it has none yet.
 *
 * Read before writing rather than upserted, because the customer is created at
 * Stripe first and the id has to come back before there is anything to store.
 */
export async function getStripeCustomerId(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  return user?.stripeCustomerId ?? null;
}

/** Records the Stripe customer an account was just created at. */
export async function setStripeCustomerId(
  userId: string,
  customerId: string,
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { stripeCustomerId: customerId },
  });

  return count > 0;
}

/**
 * Applies a subscription's state to the account behind a Stripe customer.
 *
 * Keyed on `stripeCustomerId` rather than on a user id from the webhook
 * payload: the payload is Stripe's, and the customer id is the only field in it
 * this app has itself stored.
 *
 * `updateMany` guarded on its `count` rather than `update`, the house pattern
 * every other write here follows — a customer with no matching row (a test-mode
 * event replayed against production, say) is a no-op the caller can report,
 * rather than a `P2025` throw that fails the webhook and makes Stripe retry it
 * forever.
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
