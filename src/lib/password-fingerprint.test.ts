import { describe, expect, it } from "vitest";

import { passwordFingerprint } from "@/lib/password-fingerprint";

/** Two real bcrypt hashes of different passwords, at the app's 12 rounds. */
const HASH_A = "$2b$12$4DEV0NCxVqIE3s94FcGAIOaMLwpXzYaCVhxl9u2Zm4uNT2YKQ.kn.";
const HASH_B = "$2b$12$Xk9Qq1vJm3sZ8LcW0uRr6.dYh2NfB5tGqA7eK1pS4xC8vM3nZ0oLu";

describe("passwordFingerprint", () => {
  /**
   * Null on both sides is what makes a GitHub account work: it has no password,
   * so the row's fingerprint and the token's are both null and always agree.
   */
  it("returns null for an account with no password", () => {
    expect(passwordFingerprint(null)).toBeNull();
  });

  it("returns null for an empty hash rather than fingerprinting it", () => {
    expect(passwordFingerprint("")).toBeNull();
  });

  it("is deterministic, so a session survives while the password does not change", () => {
    expect(passwordFingerprint(HASH_A)).toBe(passwordFingerprint(HASH_A));
  });

  /**
   * The whole point: change the password and every session opened with the old
   * one now carries a marker that no longer matches the row.
   */
  it("changes when the hash changes", () => {
    expect(passwordFingerprint(HASH_A)).not.toBe(passwordFingerprint(HASH_B));
  });

  it("is 16 hex characters", () => {
    expect(passwordFingerprint(HASH_A)).toMatch(/^[0-9a-f]{16}$/);
  });

  /** It rides on a JWT, so it must not carry the bcrypt hash itself. */
  it("does not embed the hash it was derived from", () => {
    expect(HASH_A).not.toContain(passwordFingerprint(HASH_A));
  });
});
