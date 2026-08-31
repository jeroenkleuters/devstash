import { beforeEach, describe, expect, it, vi } from "vitest";

import { suggestTags, suggestTagsForDraft } from "@/actions/ai";
import { checkSpend, recordSpend } from "@/lib/ai/spend";
import { AI_CHARACTER_BUDGET } from "@/lib/ai/truncate";
import { getItemDetail } from "@/lib/db/items";
import { getCurrentUser } from "@/lib/db/user";
import { rateLimit } from "@/lib/rate-limit";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

/**
 * **No test may reach OpenAI.** The client is mocked and the real
 * `runStructured` runs on top of it, so these exercise the wrapper's error
 * mapping and the exact payload the model would have received.
 */
vi.mock("@/lib/openai", () => ({
  getOpenAI: vi.fn(() => ({ responses: { parse } })),
  AI_MODEL: "gpt-5-nano",
}));

vi.mock("@/lib/db/user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemDetail: vi.fn() }));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
  tooManyAttemptsMessage: () => "Too many attempts. Please try again in 5 minutes.",
}));

vi.mock("@/lib/ai/spend", () => ({
  checkSpend: vi.fn(),
  recordSpend: vi.fn(),
  budgetExceededMessage: () =>
    "AI is paused for this month. The $5.00 budget has been used. It resets on 1 September.",
}));

const getCurrentUserMock = vi.mocked(getCurrentUser);
const getItemDetailMock = vi.mocked(getItemDetail);
const rateLimitMock = vi.mocked(rateLimit);
const checkSpendMock = vi.mocked(checkSpend);
const recordSpendMock = vi.mocked(recordSpend);

const PRO_USER = {
  id: "user-1",
  isPro: true,
  aiPreferences: { enabled: true },
} as never;

const ITEM = {
  id: "item-1",
  title: "useDebounce",
  description: "A hook that delays a value",
  content: "export function useDebounce() {}",
  tags: ["react"],
} as never;

function usage(over: Record<string, unknown> = {}) {
  return {
    input_tokens: 100,
    output_tokens: 20,
    input_tokens_details: { cached_tokens: 10 },
    ...over,
  };
}

beforeEach(() => {
  // `restoreMocks` restores `vi.spyOn` spies only, so a `vi.fn()` keeps its
  // call history across tests — which is what would make every "was not
  // called" assertion below read the *previous* test's calls, and those are
  // what actually test the gate ordering.
  vi.clearAllMocks();

  getCurrentUserMock.mockResolvedValue(PRO_USER);
  rateLimitMock.mockResolvedValue({
    success: true,
    remaining: 10,
    reset: 0,
  });
  checkSpendMock.mockResolvedValue({
    allowed: true,
    spentUsd: 1,
    budgetUsd: 5,
  });
  getItemDetailMock.mockResolvedValue(ITEM);
  recordSpendMock.mockResolvedValue(undefined);
  parse.mockResolvedValue({
    output_parsed: { tags: ["hooks", "typescript"] },
    usage: usage(),
  });
});

describe("suggestTags — the gates, in order", () => {
  it("suggests tags for a Pro account with AI on", async () => {
    const result = await suggestTags({ itemId: "item-1" });

    expect(result).toEqual({ success: true, data: ["hooks", "typescript"] });
  });

  it("refuses a signed-out caller", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await suggestTags({ itemId: "item-1" });

    expect(result).toEqual({
      success: false,
      error: "Your session has ended. Sign in again.",
    });
    expect(parse).not.toHaveBeenCalled();
  });

  /**
   * The off switch sits *before* the Pro check, so a free account that also
   * turned AI off is told it is off — not sold an upgrade for a feature it
   * deliberately switched off.
   */
  it("refuses when AI is switched off, without reaching the Pro check", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      isPro: false,
      aiPreferences: { enabled: false },
    } as never);

    const result = await suggestTags({ itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain(
      "switched off",
    );
    expect(result.success === false && result.error).not.toContain("Pro");
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  /**
   * Pro before the limiter, the ordering `POST /api/upload` establishes: a free
   * account should be told it needs Pro rather than told to wait for a window
   * that will refuse it again.
   */
  it("refuses a free account without spending one of its attempts", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      isPro: false,
      aiPreferences: { enabled: true },
    } as never);

    const result = await suggestTags({ itemId: "item-1" });

    expect(result).toEqual({
      success: false,
      error: "AI suggestions need a Pro subscription.",
    });
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(checkSpendMock).not.toHaveBeenCalled();
  });

  it("refuses a malformed request before the limiters", async () => {
    const result = await suggestTags({});

    expect(result.success).toBe(false);
    expect(rateLimitMock).not.toHaveBeenCalled();
  });

  /** Both limits are checked before the cap, and the cap is not consulted. */
  it("refuses a rate-limited caller without checking the budget", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0, reset: 0 });

    const result = await suggestTags({ itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("Too many");
    expect(checkSpendMock).not.toHaveBeenCalled();
    expect(getItemDetailMock).not.toHaveBeenCalled();
  });

  it("checks a per-feature and a combined window", async () => {
    await suggestTags({ itemId: "item-1" });

    expect(rateLimitMock).toHaveBeenCalledWith(
      "ai:tags:user-1",
      30,
      60 * 60 * 1000,
    );
    expect(rateLimitMock).toHaveBeenCalledWith(
      "ai:all:user-1",
      60,
      60 * 60 * 1000,
    );
  });

  /**
   * The cap stops a caller in a loop before it costs a database query, let
   * alone an API call.
   */
  it("refuses over budget with the flag, without reading the item", async () => {
    checkSpendMock.mockResolvedValue({
      allowed: false,
      spentUsd: 5,
      budgetUsd: 5,
    });

    const result = await suggestTags({ itemId: "item-1" });

    expect(result).toMatchObject({ success: false, budgetExceeded: true });
    expect(result.success === false && result.error).toContain("paused");
    expect(getItemDetailMock).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("answers MISSING for an item that is not the caller's", async () => {
    getItemDetailMock.mockResolvedValue(null);

    const result = await suggestTags({ itemId: "someone-elses" });

    expect(result).toEqual({
      success: false,
      error: "That item no longer exists.",
    });
    expect(parse).not.toHaveBeenCalled();
  });
});

describe("suggestTags — the call", () => {
  /**
   * The scoping the whole action rests on: content is read with the session's
   * user in the `where`, so it is provably the caller's own. A payload naming
   * a user is not consulted.
   */
  it("reads the item as the session's user, never the payload's", async () => {
    await suggestTags({ itemId: "item-1", userId: "someone-else" });

    expect(getItemDetailMock).toHaveBeenCalledWith("user-1", "item-1");
    expect(getItemDetailMock).not.toHaveBeenCalledWith(
      "someone-else",
      expect.anything(),
    );
  });

  it("sends the title, description and content", async () => {
    await suggestTags({ itemId: "item-1" });

    const sent = parse.mock.calls[0][0].input as string;

    expect(sent).toContain("useDebounce");
    expect(sent).toContain("A hook that delays a value");
    expect(sent).toContain("export function useDebounce()");
  });

  it("includes the existing tags so the model can avoid repeating them", async () => {
    await suggestTags({ itemId: "item-1" });

    expect(parse.mock.calls[0][0].input).toContain("Existing tags: react");
  });

  /** Nothing the privacy page says is not sent may appear in the payload. */
  it("sends nothing about the account or the item's storage", async () => {
    getItemDetailMock.mockResolvedValue({
      ...(ITEM as object),
      fileName: "secret-contract.pdf",
      fileUrl: "uploads/user-1/abc.pdf",
    } as never);

    await suggestTags({ itemId: "item-1" });

    const sent = parse.mock.calls[0][0].input as string;

    expect(sent).not.toContain("secret-contract.pdf");
    expect(sent).not.toContain("uploads/user-1");
    expect(sent).not.toContain("item-1");
  });

  it("truncates a huge item before it reaches the client", async () => {
    getItemDetailMock.mockResolvedValue({
      ...(ITEM as object),
      content: "x".repeat(200_000),
    } as never);

    await suggestTags({ itemId: "item-1" });

    const sent = parse.mock.calls[0][0].input as string;

    // The wrapper wraps it in delimiters, so allow for those and the marker.
    expect(sent.length).toBeLessThan(AI_CHARACTER_BUDGET + 200);
  });

  it("uses minimal effort, since reasoning bills at the output rate", async () => {
    await suggestTags({ itemId: "item-1" });

    expect(parse.mock.calls[0][0].reasoning).toEqual({ effort: "minimal" });
  });

  it("records what the call reported spending", async () => {
    await suggestTags({ itemId: "item-1" });

    expect(recordSpendMock).toHaveBeenCalledWith({
      input: 100,
      cached: 10,
      output: 20,
    });
  });

  /**
   * The work is done and the money is spent either way — a ledger write that
   * fails must not turn a suggestion the visitor already has into an error.
   */
  it("still answers when recording the spend fails", async () => {
    recordSpendMock.mockRejectedValue(new Error("redis down"));

    await expect(suggestTags({ itemId: "item-1" })).resolves.toEqual({
      success: true,
      data: ["hooks", "typescript"],
    });
  });
});

describe("suggestTags — the output", () => {
  /**
   * A reply the schema refuses reaches the action as a rejected parse. The cap
   * itself — 8 tags, 32 characters each — is asserted against the real schema
   * in `src/lib/validations/ai.test.ts`, which is where it can actually be run;
   * what matters here is that a refusal is answered rather than thrown, and
   * that nothing is billed for an answer we did not accept.
   */
  it("answers rather than throwing when the reply fails the schema", async () => {
    parse.mockRejectedValue(
      Object.assign(new Error("schema"), { name: "ZodError" }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await suggestTags({ itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(recordSpendMock).not.toHaveBeenCalled();
  });

  it("answers a message when the model returns nothing usable", async () => {
    parse.mockResolvedValue({ output_parsed: null, usage: usage() });

    const result = await suggestTags({ itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain(
      "could not answer",
    );
    expect(recordSpendMock).not.toHaveBeenCalled();
  });

  /** Our key being wrong is nothing the visitor can act on. */
  it("answers generically and logs for an authentication failure", async () => {
    const openai = await import("openai");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    parse.mockRejectedValue(
      new openai.AuthenticationError(
        401 as never,
        undefined as never,
        "bad key" as never,
        undefined as never,
      ),
    );

    const result = await suggestTags({ itemId: "item-1" });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).not.toContain("key");
    expect(error).toHaveBeenCalled();
  });
});

describe("suggestTagsForDraft — the create dialog's path", () => {
  const DRAFT = {
    title: "useThrottle",
    description: "Limits how often a value updates",
    content: "export function useThrottle() {}",
    tags: ["react"],
  };

  it("suggests against what has been typed, with no row to read", async () => {
    const result = await suggestTagsForDraft(DRAFT);

    expect(result).toEqual({ success: true, data: ["hooks", "typescript"] });
    // The whole point of this path: nothing is read, because nothing is stored.
    expect(getItemDetailMock).not.toHaveBeenCalled();
  });

  it("sends what was typed", async () => {
    await suggestTagsForDraft(DRAFT);

    const sent = parse.mock.calls[0][0].input as string;

    expect(sent).toContain("useThrottle");
    expect(sent).toContain("Limits how often a value updates");
    expect(sent).toContain("export function useThrottle()");
    expect(sent).toContain("Existing tags: react");
  });

  /**
   * The gates are the whole reason accepting content here is defensible, so
   * they are asserted on this path too rather than assumed from the sibling.
   */
  it("runs the same gates, in the same order", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user-1",
      isPro: false,
      aiPreferences: { enabled: true },
    } as never);

    const result = await suggestTagsForDraft(DRAFT);

    expect(result).toEqual({
      success: false,
      error: "AI suggestions need a Pro subscription.",
    });
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("counts against the same windows as the id path", async () => {
    await suggestTagsForDraft(DRAFT);

    expect(rateLimitMock).toHaveBeenCalledWith("ai:tags:user-1", 30, 60 * 60 * 1000);
    expect(rateLimitMock).toHaveBeenCalledWith("ai:all:user-1", 60, 60 * 60 * 1000);
  });

  it("refuses over budget with the flag", async () => {
    checkSpendMock.mockResolvedValue({ allowed: false, spentUsd: 5, budgetUsd: 5 });

    const result = await suggestTagsForDraft(DRAFT);

    expect(result).toMatchObject({ success: false, budgetExceeded: true });
    expect(parse).not.toHaveBeenCalled();
  });

  /** A call that can only disappoint should not be billed for. */
  it("refuses an empty draft without calling the model", async () => {
    const result = await suggestTagsForDraft({
      title: "   ",
      description: "",
      content: "  ",
      tags: [],
    });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain("title");
    expect(parse).not.toHaveBeenCalled();
  });

  it("accepts a draft with only content, or only a title", async () => {
    await expect(
      suggestTagsForDraft({ title: "", description: "", content: "const x = 1;", tags: [] }),
    ).resolves.toMatchObject({ success: true });

    await expect(
      suggestTagsForDraft({ title: "A title", description: "", content: "", tags: [] }),
    ).resolves.toMatchObject({ success: true });
  });

  it("truncates a huge draft before it reaches the client", async () => {
    await suggestTagsForDraft({ ...DRAFT, content: "x".repeat(110_000) });

    const sent = parse.mock.calls[0][0].input as string;

    expect(sent.length).toBeLessThan(AI_CHARACTER_BUDGET + 200);
  });

  /**
   * Bounded before anything reads it, so a multi-megabyte body is refused
   * outright rather than accepted and trimmed.
   */
  it("refuses a payload far beyond any real draft", async () => {
    const result = await suggestTagsForDraft({
      ...DRAFT,
      content: "x".repeat(500_000),
    });

    expect(result.success).toBe(false);
    expect(parse).not.toHaveBeenCalled();
  });
});
