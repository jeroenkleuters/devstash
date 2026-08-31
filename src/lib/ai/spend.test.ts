import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, incrby, expire } = vi.hoisted(() => ({
  get: vi.fn(),
  incrby: vi.fn(),
  expire: vi.fn(),
}));

/**
 * Upstash is replaced wholesale — no test may reach Redis, and what matters
 * here is the arithmetic and the direction each failure falls in.
 *
 * A class rather than a `vi.fn`, because the module calls it with `new`.
 */
vi.mock("@upstash/redis", () => ({
  Redis: class Redis {
    get = get;
    incrby = incrby;
    expire = expire;
  },
}));

/**
 * The client is memoized at module scope, so every test that needs a different
 * configuration re-imports the module. `vi.resetModules()` in `beforeEach` is
 * what makes that give a fresh one rather than the previous test's.
 */
async function load() {
  return import("@/lib/ai/spend");
}

const AUGUST = new Date("2026-08-15T12:00:00Z");

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
  vi.stubEnv("AI_MONTHLY_BUDGET_USD", "5");
  get.mockResolvedValue(0);
  incrby.mockResolvedValue(1);
  expire.mockResolvedValue(1);
});

describe("costOf", () => {
  it("prices input and output at the published rates", async () => {
    const { costOf } = await load();

    // 1M input at $0.05 = $0.05 = 50,000 micro-dollars.
    expect(costOf({ input: 1_000_000, cached: 0, output: 0 })).toBe(50_000);
    // 1M output at $0.40 = $0.40 = 400,000 micro-dollars.
    expect(costOf({ input: 0, cached: 0, output: 1_000_000 })).toBe(400_000);
  });

  /**
   * The arithmetic mistake this whole module has to avoid, and the reason it
   * gets its own test: `cached` is a *detail of* `input`, not additional to
   * it. Pricing both counts bills the cached share twice, once at the cached
   * rate and again at ten times that. It fails in the safe direction —
   * over-counting, so the cap trips early — which is why it could sit
   * unnoticed for a long time.
   */
  it("subtracts the cached tokens from the input before pricing", async () => {
    const { costOf } = await load();

    // 1,000 input of which 800 cached = 200 at $0.05/M + 800 at $0.005/M.
    const expected = Math.round(
      ((200 * 0.05 + 800 * 0.005) / 1_000_000) * 1_000_000,
    );

    expect(costOf({ input: 1_000, cached: 800, output: 0 })).toBe(expected);

    // And it is strictly cheaper than pricing the whole input uncached, which
    // is what the naive version would charge.
    const naive = Math.round(
      ((1_000 * 0.05 + 800 * 0.005) / 1_000_000) * 1_000_000,
    );

    expect(costOf({ input: 1_000, cached: 800, output: 0 })).toBeLessThan(naive);
  });

  it("costs nothing for a call that reported no usage", async () => {
    const { costOf } = await load();

    expect(costOf({ input: 0, cached: 0, output: 0 })).toBe(0);
  });

  it("does not credit the ledger when cached exceeds input", async () => {
    const { costOf } = await load();

    // Nonsense from a remote response must not price negative tokens.
    expect(
      costOf({ input: 100, cached: 500, output: 0 }),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("spendKey", () => {
  it("names the calendar month in UTC", async () => {
    const { spendKey } = await load();

    expect(spendKey(AUGUST)).toBe("devstash:ai:spend:2026-08");
    expect(spendKey(new Date("2026-01-01T00:00:00Z"))).toBe(
      "devstash:ai:spend:2026-01",
    );
  });
});

describe("monthlyBudgetUsd", () => {
  it("reads the configured cap", async () => {
    vi.stubEnv("AI_MONTHLY_BUDGET_USD", "12.5");
    const { monthlyBudgetUsd } = await load();

    expect(monthlyBudgetUsd()).toBe(12.5);
  });

  it("falls back to a small number rather than to unlimited", async () => {
    // The one reading that would spend money is "unset means no budget".
    for (const value of ["", "not-a-number", "-1"]) {
      vi.resetModules();
      vi.stubEnv("AI_MONTHLY_BUDGET_USD", value);
      const { monthlyBudgetUsd } = await load();

      expect(monthlyBudgetUsd()).toBe(5);
    }
  });
});

describe("checkSpend", () => {
  it("allows a call when the month is under the cap", async () => {
    get.mockResolvedValue(1_000_000); // $1.00 of a $5.00 budget
    const { checkSpend } = await load();

    const result = await checkSpend(AUGUST);

    expect(result.allowed).toBe(true);
    expect(result.spentUsd).toBe(1);
    expect(result.budgetUsd).toBe(5);
    expect(get).toHaveBeenCalledWith("devstash:ai:spend:2026-08");
  });

  it("refuses exactly at the cap", async () => {
    // `>=`, matching `usage-limits`: an amount that has reached the cap has
    // used it, so the next call is the one over.
    get.mockResolvedValue(5_000_000);
    const { checkSpend } = await load();

    expect((await checkSpend(AUGUST)).allowed).toBe(false);
  });

  it("refuses over the cap", async () => {
    get.mockResolvedValue(9_999_999);
    const { checkSpend } = await load();

    expect((await checkSpend(AUGUST)).allowed).toBe(false);
  });

  it("treats an empty ledger as nothing spent", async () => {
    get.mockResolvedValue(null);
    const { checkSpend } = await load();

    const result = await checkSpend(AUGUST);

    expect(result.allowed).toBe(true);
    expect(result.spentUsd).toBe(0);
  });

  /**
   * The branch most worth having a test for, and a deliberate inconsistency
   * with `rateLimit`, which fails open. If the ledger cannot be read the spend
   * is unknown, and spending an unknown amount against a hard cap is precisely
   * what the cap exists to prevent.
   */
  it("fails CLOSED when Redis is unreachable", async () => {
    get.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkSpend } = await load();

    expect((await checkSpend(AUGUST)).allowed).toBe(false);
  });

  it("fails CLOSED when Redis is not configured at all", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkSpend } = await load();

    const result = await checkSpend(AUGUST);

    expect(result.allowed).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("recordSpend", () => {
  it("adds the call's cost to this month's key", async () => {
    incrby.mockResolvedValue(999_999);
    const { recordSpend, costOf } = await load();
    const usage = { input: 1_000, cached: 0, output: 500 };

    await recordSpend(usage, AUGUST);

    expect(incrby).toHaveBeenCalledWith(
      "devstash:ai:spend:2026-08",
      costOf(usage),
    );
  });

  it("sets a TTL only on the first write of the month", async () => {
    const { recordSpend, costOf } = await load();
    const usage = { input: 1_000, cached: 0, output: 500 };
    const cost = costOf(usage);

    // The counter coming back equal to what we just added means it was created
    // by this call. Expiring on every write would push the window forward
    // forever and the key would never fall out.
    incrby.mockResolvedValue(cost);
    await recordSpend(usage, AUGUST);
    expect(expire).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    incrby.mockResolvedValue(cost * 7);
    await recordSpend(usage, AUGUST);
    expect(expire).not.toHaveBeenCalled();
  });

  it("writes nothing for a call that cost nothing", async () => {
    const { recordSpend } = await load();

    await recordSpend({ input: 0, cached: 0, output: 0 }, AUGUST);

    expect(incrby).not.toHaveBeenCalled();
  });

  /**
   * A ledger write that fails must not turn a suggestion the visitor already
   * has into an error they see — the work is done and the money is spent
   * either way. The cost is that the increment is lost.
   */
  it("swallows a write failure rather than throwing", async () => {
    incrby.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { recordSpend } = await load();

    await expect(
      recordSpend({ input: 1_000, cached: 0, output: 500 }, AUGUST),
    ).resolves.toBeUndefined();
  });
});
