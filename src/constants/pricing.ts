import type { BillingPlan } from "@/types/billing";

/**
 * What each plan is called and costs, as the marketing page and the upgrade
 * dialog state it.
 *
 * **Display copy, not the source of truth.** What is actually charged is the
 * amount behind the Stripe price id `STRIPE_PRICE_MONTHLY` / `_YEARLY` names,
 * which this app never reads — so these figures can drift from it, and Stripe's
 * own checkout page states the real one before anything is charged. They live
 * here rather than being written out per component so at least the places that
 * do quote a price quote the same one. The billing card in settings quotes none
 * at all, for the same reason.
 */
export interface PlanPricing {
  /** How the plan is named on a control. */
  label: string;
  /** The amount, formatted. */
  amount: string;
  /** What the amount buys, e.g. "per month". */
  period: string;
  /** A short reason to prefer it, or undefined when it needs none. */
  note?: string;
}

export const PLAN_PRICING: Record<BillingPlan, PlanPricing> = {
  monthly: {
    label: "Monthly",
    amount: "$8",
    period: "per month",
  },
  yearly: {
    label: "Yearly",
    amount: "$72",
    period: "per year",
    note: "Two months free",
  },
};
