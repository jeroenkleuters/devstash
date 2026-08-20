import { AuthError, CredentialsSignin } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { signInWithCredentials } from "@/actions/auth";
import { signIn } from "@/auth";
import {
  SIGN_IN_INITIAL_STATE,
  TOO_MANY_ATTEMPTS_CODE,
  UNVERIFIED_EMAIL_CODE,
} from "@/types/auth";

/**
 * `@/auth` is the whole NextAuth instance — Prisma adapter, bcrypt, the real
 * `authorize` — so it is replaced wholesale. What is under test is the action's
 * own job: validate, hand off, and turn whatever comes back into form state.
 */
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));

const signInMock = vi.mocked(signIn);

function formData(fields: Record<string, string>) {
  const data = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    data.append(name, value);
  }

  return data;
}

function submit(fields: Record<string, string>) {
  return signInWithCredentials(SIGN_IN_INITIAL_STATE, formData(fields));
}

/** A rejection carrying one of the codes `src/auth.ts` throws. */
function credentialsError(code?: string) {
  class TestCredentialsSignin extends CredentialsSignin {
    code = code ?? "credentials";
  }

  return new TestCredentialsSignin();
}

describe("signInWithCredentials", () => {
  describe("validation", () => {
    it("rejects a malformed email without reaching Auth.js", async () => {
      const state = await submit({ email: "nope", password: "whatever" });

      expect(state.error).toBe("Enter a valid email address.");
      expect(state.rateLimited).toBe(false);
      expect(signInMock).not.toHaveBeenCalled();
    });

    it("rejects an empty password", async () => {
      const state = await submit({ email: "demo@devstash.io", password: "" });

      expect(state.error).toBe("Password is required.");
      expect(signInMock).not.toHaveBeenCalled();
    });

    /**
     * React resets the form once the action settles, so a rejected attempt has
     * to hand the address back or the visitor retypes what they almost
     * certainly got right. It is echoed as submitted, not as normalized.
     */
    it("echoes the submitted address back on every rejection", async () => {
      const state = await submit({ email: "  NOPE  ", password: "" });

      expect(state.email).toBe("  NOPE  ");
    });
  });

  describe("hand-off to Auth.js", () => {
    it("passes the normalized credentials and the default destination", async () => {
      await submit({ email: " DEMO@DevStash.io ", password: "hunter2000" });

      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: "demo@devstash.io",
        password: "hunter2000",
        redirectTo: "/dashboard",
      });
    });

    /**
     * Handed over as `redirectTo` rather than used directly: Auth.js's own
     * `redirect` callback drops anything off-origin, so a tampered
     * `callbackUrl` cannot turn this form into an open redirect.
     */
    it("forwards a callbackUrl instead of redirecting on it here", async () => {
      await submit({
        email: "demo@devstash.io",
        password: "hunter2000",
        callbackUrl: "http://localhost:3000/items/snippets",
      });

      expect(signInMock).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({
          redirectTo: "http://localhost:3000/items/snippets",
        }),
      );
    });

    it("falls back to the default when callbackUrl is empty", async () => {
      await submit({
        email: "demo@devstash.io",
        password: "hunter2000",
        callbackUrl: "",
      });

      expect(signInMock).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirectTo: "/dashboard" }),
      );
    });
  });

  describe("failures", () => {
    it("reports a wrong password without saying which half was wrong", async () => {
      signInMock.mockRejectedValueOnce(credentialsError());

      const state = await submit({
        email: "demo@devstash.io",
        password: "wrong",
      });

      expect(state.error).toBe("Incorrect email or password.");
      expect(state.rateLimited).toBe(false);
      expect(state.email).toBe("demo@devstash.io");
    });

    /**
     * Named only because `authorize` throws it after the password has already
     * matched, so it tells the visitor nothing they did not just prove.
     */
    it("names an unverified email", async () => {
      signInMock.mockRejectedValueOnce(credentialsError(UNVERIFIED_EMAIL_CODE));

      const state = await submit({
        email: "demo@devstash.io",
        password: "right",
      });

      expect(state.error).toMatch(/Verify your email/);
      expect(state.rateLimited).toBe(false);
    });

    /** The one failure the form shows as a toast rather than under the field. */
    it("flags the rate limit so the form can toast it", async () => {
      signInMock.mockRejectedValueOnce(credentialsError(TOO_MANY_ATTEMPTS_CODE));

      const state = await submit({
        email: "demo@devstash.io",
        password: "right",
      });

      expect(state.error).toMatch(/Too many sign-in attempts/);
      expect(state.rateLimited).toBe(true);
    });

    it("treats an unrecognised code as a plain rejection", async () => {
      signInMock.mockRejectedValueOnce(credentialsError("something_new"));

      const state = await submit({
        email: "demo@devstash.io",
        password: "right",
      });

      expect(state.error).toBe("Incorrect email or password.");
      expect(state.rateLimited).toBe(false);
    });

    it("separates a misconfiguration from a bad credential", async () => {
      class ConfigError extends AuthError {}
      signInMock.mockRejectedValueOnce(new ConfigError("boom"));

      const state = await submit({
        email: "demo@devstash.io",
        password: "right",
      });

      expect(state.error).toBe("Could not sign you in. Try again.");
    });

    /**
     * The one that must not be caught: a *successful* sign-in leaves through
     * the redirect Next throws. Swallowing it would strand the visitor on the
     * form after signing them in.
     */
    it("rethrows anything that is not an AuthError", async () => {
      const redirect = new Error("NEXT_REDIRECT");
      signInMock.mockRejectedValueOnce(redirect);

      await expect(
        submit({ email: "demo@devstash.io", password: "right" }),
      ).rejects.toBe(redirect);
    });
  });
});
