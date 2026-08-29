import { beforeEach, describe, expect, it, vi } from "vitest";

import { openBillingPortal, startCheckout } from "@/actions/billing";
import { getStripeCustomerId, setStripeCustomerId } from "@/lib/db/billing";
import { getCurrentUser, type CurrentUser } from "@/lib/db/user";
import { getStripe } from "@/lib/stripe";

/**
 * Everything the action reaches is replaced: `@/lib/db/*` import `@/lib/prisma`,
 * which throws at import time without a `DATABASE_URL`, and `@/lib/stripe`
 * would otherwise want a live key. What is left under test is the action's own
 * job — the session, the refusals, resolving the price, and reusing the
 * customer rather than creating a second one.
 */
vi.mock("@/lib/db/user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({
  getStripeCustomerId: vi.fn(),
  setStripeCustomerId: vi.fn(),
}));
vi.mock("@/lib/stripe", async () => {
  // `priceIdFor` is pure and reads the environment, so the real one is kept and
  // driven with `vi.stubEnv` — mocking it would test the mock.
  const actual = await vi.importActual<typeof import("@/lib/stripe")>(
    "@/lib/stripe",
  );

  return { ...actual, getStripe: vi.fn() };
});

const getCurrentUserMock = vi.mocked(getCurrentUser);
const getStripeCustomerIdMock = vi.mocked(getStripeCustomerId);
const setStripeCustomerIdMock = vi.mocked(setStripeCustomerId);
const getStripeMock = vi.mocked(getStripe);

const FREE_USER = {
  id: "user-1",
  name: "Demo User",
  email: "demo@devstash.io",
  isPro: false,
  hasBilling: false,
} as CurrentUser;

const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_123";
const PORTAL_URL = "https://billing.stripe.com/p/session/bps_test_123";

const customersCreate = vi.fn();
const checkoutSessionsCreate = vi.fn();
const portalSessionsCreate = vi.fn();

/** Only the three calls the actions make, shaped like the SDK's surface. */
const stripe = {
  customers: { create: customersCreate },
  checkout: { sessions: { create: checkoutSessionsCreate } },
  billingPortal: { sessions: { create: portalSessionsCreate } },
} as unknown as ReturnType<typeof getStripe>;

beforeEach(() => {
  // `restoreMocks` only restores spies, so a `vi.fn()` keeps its calls between
  // tests — without this the "not called" assertions would read the last one's.
  vi.clearAllMocks();

  // Vitest loads no `.env`, so these are the only values the action can see.
  vi.stubEnv("APP_URL", "https://devstash.test");
  vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "price_monthly");
  vi.stubEnv("STRIPE_PRICE_ID_YEARLY", "price_yearly");

  getCurrentUserMock.mockResolvedValue(FREE_USER);
  getStripeCustomerIdMock.mockResolvedValue(null);
  setStripeCustomerIdMock.mockResolvedValue(true);
  getStripeMock.mockReturnValue(stripe);

  customersCreate.mockResolvedValue({ id: "cus_new" });
  checkoutSessionsCreate.mockResolvedValue({
    id: "cs_test_123",
    url: CHECKOUT_URL,
  });
  portalSessionsCreate.mockResolvedValue({ url: PORTAL_URL });
});

describe("startCheckout", () => {
  it("refuses a session whose account is gone, without reaching Stripe", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await startCheckout({ plan: "monthly" });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(getStripeMock).not.toHaveBeenCalled();
    expect(getStripeCustomerIdMock).not.toHaveBeenCalled();
  });

  it("refuses an account that is already on Pro", async () => {
    getCurrentUserMock.mockResolvedValue({ ...FREE_USER, isPro: true });

    const result = await startCheckout({ plan: "monthly" });

    expect(result).toEqual({ success: false, error: "You are already on Pro." });
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a payload that names no known plan", async () => {
    const result = await startCheckout({ plan: "lifetime" });

    expect(result.success).toBe(false);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses a price id sent in place of a plan", async () => {
    // The client names a choice, never a value — otherwise a caller could
    // subscribe themselves to any price in the Stripe account, a $0 one
    // included.
    const result = await startCheckout({ plan: "price_yearly" });

    expect(result.success).toBe(false);
    expect(checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it("fails without calling Stripe when the plan has no price configured", async () => {
    vi.stubEnv("STRIPE_PRICE_ID_YEARLY", "");

    const result = await startCheckout({ plan: "yearly" });

    expect(result).toEqual({
      success: false,
      error: "Could not start checkout. Try again.",
    });
    expect(getStripeMock).not.toHaveBeenCalled();
  });

  it("resolves the plan to the configured price", async () => {
    await startCheckout({ plan: "yearly" });

    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_yearly", quantity: 1 }],
      }),
    );
  });

  it("creates the Stripe customer when the account has none, and records it", async () => {
    const result = await startCheckout({ plan: "monthly" });

    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "demo@devstash.io",
        metadata: { userId: "user-1" },
      }),
    );
    expect(setStripeCustomerIdMock).toHaveBeenCalledWith("user-1", "cus_new");
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new" }),
    );
    expect(result).toEqual({ success: true, url: CHECKOUT_URL });
  });

  it("reuses the stored customer rather than creating a second one", async () => {
    getStripeCustomerIdMock.mockResolvedValue("cus_existing");

    await startCheckout({ plan: "monthly" });

    expect(customersCreate).not.toHaveBeenCalled();
    expect(setStripeCustomerIdMock).not.toHaveBeenCalled();
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("builds the return URLs from APP_URL, never from a request", async () => {
    await startCheckout({ plan: "monthly" });

    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://devstash.test/settings?checkout=success",
        cancel_url: "https://devstash.test/settings?checkout=cancelled",
      }),
    );
  });

  it("reports a session that came back with no URL rather than returning one", async () => {
    checkoutSessionsCreate.mockResolvedValue({ id: "cs_test_123" });

    const result = await startCheckout({ plan: "monthly" });

    expect(result).toEqual({
      success: false,
      error: "Could not start checkout. Try again.",
    });
  });

  it("turns a Stripe failure into a message rather than a throw", async () => {
    checkoutSessionsCreate.mockRejectedValue(new Error("stripe is down"));

    await expect(startCheckout({ plan: "monthly" })).resolves.toEqual({
      success: false,
      error: "Could not start checkout. Try again.",
    });
  });
});

describe("openBillingPortal", () => {
  it("refuses a session whose account is gone", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await openBillingPortal();

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(getStripeMock).not.toHaveBeenCalled();
  });

  it("refuses an account with no Stripe customer", async () => {
    getStripeCustomerIdMock.mockResolvedValue(null);

    const result = await openBillingPortal();

    expect(result).toEqual({
      success: false,
      error: "You do not have a subscription to manage.",
    });
    expect(portalSessionsCreate).not.toHaveBeenCalled();
  });

  it("opens the portal for the stored customer and returns where to go", async () => {
    getStripeCustomerIdMock.mockResolvedValue("cus_existing");

    const result = await openBillingPortal();

    expect(portalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://devstash.test/settings",
    });
    expect(result).toEqual({ success: true, url: PORTAL_URL });
  });

  it("turns a Stripe failure into a message rather than a throw", async () => {
    getStripeCustomerIdMock.mockResolvedValue("cus_existing");
    portalSessionsCreate.mockRejectedValue(new Error("stripe is down"));

    await expect(openBillingPortal()).resolves.toEqual({
      success: false,
      error: "Could not open billing. Try again.",
    });
  });
});
