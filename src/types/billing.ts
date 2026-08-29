/** The two subscription cadences the pricing page offers. */
export const BILLING_PLANS = ["monthly", "yearly"] as const;

export type BillingPlan = (typeof BILLING_PLANS)[number];

/**
 * What `startCheckout` answers with. The successful half carries the Stripe URL
 * the browser is sent to; there is nothing to render on success.
 */
export type StartCheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

/** What `openBillingPortal` answers with. Same shape, same reason. */
export type BillingPortalResult =
  | { success: true; url: string }
  | { success: false; error: string };
