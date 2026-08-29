import { z } from "zod";

import { BILLING_PLANS } from "@/types/billing";

/**
 * What `startCheckout` accepts.
 *
 * An enum rather than a price id: the price a plan maps to is the
 * environment's to decide, so a request may name which plan it wants but not
 * what it costs. This is the same reasoning `createItem` uses for `typeSlug`
 * over `itemTypeId`, and `saveUploadPreferences` for its fixed offered set —
 * the client names a choice, the server resolves it to a value. A raw `price_…`
 * in the payload would let a caller subscribe themselves to any price in the
 * Stripe account, a $0 one included.
 */
export const startCheckoutSchema = z.object({
  plan: z.enum(BILLING_PLANS),
});
