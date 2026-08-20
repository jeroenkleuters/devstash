import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  changePasswordSchema,
  firstIssueMessage,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/lib/validations/auth";

/** A password that satisfies every rule, so a test can vary one field at a time. */
const VALID = {
  name: "Demo User",
  email: "demo@devstash.io",
  password: "correct horse",
  confirmPassword: "correct horse",
};

/** The first issue's message, or a marker so a passing parse fails loudly. */
function messageOf(result: { success: boolean; error?: ZodError }) {
  return result.success ? "PARSED" : firstIssueMessage(result.error!);
}

describe("email normalization", () => {
  /**
   * Registration and sign-in share one email schema. Without the trim and the
   * lowercase, registering `Test@Example.com` would create a row that a later
   * `test@example.com` sign-in could never find.
   */
  it("trims and lowercases before the format check", () => {
    const result = signInSchema.safeParse({
      email: "  DEMO@DevStash.io  ",
      password: "whatever",
    });

    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("demo@devstash.io");
  });

  it("normalizes on registration too, so the two agree", () => {
    const result = registerSchema.safeParse({
      ...VALID,
      email: "  NEW@Example.COM ",
    });

    expect(result.data?.email).toBe("new@example.com");
  });

  it("rejects an address that is not one", () => {
    const result = signInSchema.safeParse({
      email: "not-an-address",
      password: "whatever",
    });

    expect(messageOf(result)).toBe("Enter a valid email address.");
  });
});

describe("signInSchema", () => {
  /**
   * Presence only. The length rule belongs to registration — tightening it here
   * would lock out any account whose password predates the rule.
   */
  it("accepts a password too short to register with", () => {
    const result = signInSchema.safeParse({
      email: "demo@devstash.io",
      password: "old",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = signInSchema.safeParse({
      email: "demo@devstash.io",
      password: "",
    });

    expect(messageOf(result)).toBe("Password is required.");
  });
});

describe("registerSchema", () => {
  it("accepts a well-formed registration", () => {
    expect(registerSchema.safeParse(VALID).success).toBe(true);
  });

  it("trims the name and rejects one that is only whitespace", () => {
    expect(registerSchema.safeParse({ ...VALID, name: "  Demo  " }).data?.name)
      .toBe("Demo");
    expect(messageOf(registerSchema.safeParse({ ...VALID, name: "   " }))).toBe(
      "Name is required.",
    );
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({
      ...VALID,
      password: "short",
      confirmPassword: "short",
    });

    expect(messageOf(result)).toBe("Password must be at least 8 characters.");
  });

  it("reports the mismatch against the confirmation field", () => {
    const result = registerSchema.safeParse({
      ...VALID,
      confirmPassword: "something else",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Passwords do not match.");
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  /**
   * bcrypt hashes only the first 72 bytes and silently drops the rest, so an
   * over-length passphrase would be interchangeable with any string sharing its
   * first 72. The cap counts UTF-8 bytes rather than `.length`, since one
   * character can encode to four — an emoji password is the case that separates
   * the two readings, and the one that made this rule necessary.
   */
  describe("the 72-byte bcrypt cap", () => {
    const TOO_LONG = "Password must be at most 72 bytes.";

    it("accepts exactly 72 ASCII bytes and rejects 73", () => {
      const at = "a".repeat(72);
      const over = "a".repeat(73);

      expect(
        registerSchema.safeParse({
          ...VALID,
          password: at,
          confirmPassword: at,
        }).success,
      ).toBe(true);
      expect(
        messageOf(
          registerSchema.safeParse({
            ...VALID,
            password: over,
            confirmPassword: over,
          }),
        ),
      ).toBe(TOO_LONG);
    });

    it("counts a 4-byte emoji as four, not one", () => {
      // 18 emoji = 72 bytes but only 36 UTF-16 code units, so a `.length` check
      // would wave through the 19th as well.
      const at = "😀".repeat(18);
      const over = "😀".repeat(19);

      expect(new TextEncoder().encode(at).length).toBe(72);
      expect(over.length).toBeLessThan(72);

      expect(
        registerSchema.safeParse({
          ...VALID,
          password: at,
          confirmPassword: at,
        }).success,
      ).toBe(true);
      expect(
        messageOf(
          registerSchema.safeParse({
            ...VALID,
            password: over,
            confirmPassword: over,
          }),
        ),
      ).toBe(TOO_LONG);
    });
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a token with a matching password pair", () => {
    const result = resetPasswordSchema.safeParse({
      token: "a-token",
      password: VALID.password,
      confirmPassword: VALID.confirmPassword,
    });

    expect(result.success).toBe(true);
  });

  /** An empty token means a mangled link, not anything the visitor typed. */
  it("rejects an empty token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: VALID.password,
      confirmPassword: VALID.confirmPassword,
    });

    expect(messageOf(result)).toBe("That reset link is missing its token.");
  });

  it("applies the same byte cap as registration", () => {
    const over = "a".repeat(73);
    const result = resetPasswordSchema.safeParse({
      token: "a-token",
      password: over,
      confirmPassword: over,
    });

    expect(messageOf(result)).toBe("Password must be at most 72 bytes.");
  });
});

describe("changePasswordSchema", () => {
  it("accepts a current password too short to register with", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      password: VALID.password,
      confirmPassword: VALID.confirmPassword,
    });

    expect(result.success).toBe(true);
  });

  it("requires the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      password: VALID.password,
      confirmPassword: VALID.confirmPassword,
    });

    expect(messageOf(result)).toBe("Enter your current password.");
  });
});

describe("firstIssueMessage", () => {
  it("returns the first issue's message", () => {
    const result = signInSchema.safeParse({ email: "nope", password: "" });

    expect(firstIssueMessage(result.error!)).toBe(
      "Enter a valid email address.",
    );
  });

  it("falls back when an error somehow carries no issues", () => {
    expect(firstIssueMessage(new ZodError([]))).toBe("Invalid request.");
  });
});
