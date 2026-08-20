import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  callerKey,
  retryAfterSeconds,
  tooManyAttemptsMessage,
  tooManyAttemptsResponse,
  type RateLimitResult,
} from "@/lib/rate-limit";

/**
 * Only the pure half of the module is exercised here. `rateLimit` itself talks
 * to Upstash over HTTP, and its behaviour that matters — failing open on a
 * missing config, a bad token and an unreachable host — is a property of the
 * network call rather than of logic worth mocking a client to reach.
 */

const NOW = new Date("2026-08-20T12:00:00Z").getTime();

function result(
  success: boolean,
  resetInSeconds: number,
  remaining = 0,
): RateLimitResult {
  return { success, remaining, reset: NOW + resetInSeconds * 1000 };
}

describe("callerKey", () => {
  function requestWith(headers: Record<string, string>) {
    return new Request("http://localhost:3000/api/auth/register", { headers });
  }

  it("takes the first entry, which a proxy appends to", () => {
    expect(
      callerKey(requestWith({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })),
    ).toBe("1.2.3.4");
  });

  it("trims the entry it takes", () => {
    expect(callerKey(requestWith({ "x-forwarded-for": "  1.2.3.4  " }))).toBe(
      "1.2.3.4",
    );
  });

  /**
   * Every caller without the header shares one bucket. That is deliberate — it
   * fails toward limiting rather than toward waving through — and it is why no
   * endpoint leans on the per-IP window alone.
   */
  it("falls back to a shared key when the header is missing", () => {
    expect(callerKey(requestWith({}))).toBe("unknown");
  });

  it("falls back when the header is present but empty", () => {
    expect(callerKey(requestWith({ "x-forwarded-for": "" }))).toBe("unknown");
    expect(callerKey(requestWith({ "x-forwarded-for": " , " }))).toBe("unknown");
  });
});

describe("retryAfterSeconds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * An endpoint checks a per-email and a per-IP window. Only the spent one is
   * holding the caller up, so quoting the untouched one's reset would overstate
   * the wait — often by a lot, since the two windows fill at different rates.
   */
  it("ignores a window that still has room", () => {
    const spent = result(false, 60);
    const roomy = result(true, 3600);

    expect(retryAfterSeconds(spent, roomy)).toBe(60);
  });

  it("takes the longest wait when several windows are spent", () => {
    expect(retryAfterSeconds(result(false, 60), result(false, 900))).toBe(900);
  });

  it("falls back to the widest reset when nothing is spent", () => {
    expect(retryAfterSeconds(result(true, 30), result(true, 120))).toBe(120);
  });

  it("never reports less than a second, even for a reset already past", () => {
    expect(retryAfterSeconds(result(false, -30))).toBe(1);
  });

  it("rounds a partial second up", () => {
    expect(retryAfterSeconds(result(false, 0.4))).toBe(1);
    expect(retryAfterSeconds(result(false, 90.2))).toBe(91);
  });
});

describe("tooManyAttemptsMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rounds up to whole minutes", () => {
    expect(tooManyAttemptsMessage(result(false, 61))).toBe(
      "Too many attempts. Please try again in 2 minutes.",
    );
  });

  it("says minute, singular, for anything under one", () => {
    expect(tooManyAttemptsMessage(result(false, 10))).toBe(
      "Too many attempts. Please try again in 1 minute.",
    );
  });
});

describe("tooManyAttemptsResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is a 429 carrying Retry-After in seconds", async () => {
    const response = tooManyAttemptsResponse(result(false, 600));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
  });

  /** Shaped like every other failure these routes return, so `error` reads the same. */
  it("returns the standard failure body", async () => {
    const response = tooManyAttemptsResponse(result(false, 600));

    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Too many attempts. Please try again in 10 minutes.",
    });
  });
});
