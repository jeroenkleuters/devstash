import { describe, expect, it } from "vitest";

import { startCheckoutSchema } from "@/lib/validations/billing";

describe("startCheckoutSchema", () => {
  it("accepts both plans the pricing page offers", () => {
    expect(startCheckoutSchema.parse({ plan: "monthly" })).toEqual({
      plan: "monthly",
    });
    expect(startCheckoutSchema.parse({ plan: "yearly" })).toEqual({
      plan: "yearly",
    });
  });

  it("refuses a plan the app does not offer", () => {
    expect(startCheckoutSchema.safeParse({ plan: "lifetime" }).success).toBe(
      false,
    );
    expect(startCheckoutSchema.safeParse({}).success).toBe(false);
  });

  // The client names a choice and the server resolves it to a price, so a price
  // id must never parse — it would let a caller pick what they pay.
  it("refuses a raw Stripe price id", () => {
    expect(
      startCheckoutSchema.safeParse({ plan: "price_1U9abcDEFghiJKL" }).success,
    ).toBe(false);
  });

  it("keeps nothing but the plan", () => {
    expect(
      startCheckoutSchema.parse({ plan: "monthly", priceId: "price_1U9" }),
    ).toEqual({ plan: "monthly" });
  });
});
