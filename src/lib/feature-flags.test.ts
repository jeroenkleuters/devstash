import { describe, expect, it, vi } from "vitest";

import { isEmailVerificationEnabled } from "@/lib/feature-flags";

const FLAG = "EMAIL_VERIFICATION_ENABLED";

describe("isEmailVerificationEnabled", () => {
  /**
   * The direction that matters: an environment that forgot the variable keeps
   * the requirement rather than silently dropping it. Turning it off is
   * explicit, which is why only a known list of values does so.
   */
  it("defaults to on when the variable is unset", () => {
    vi.stubEnv(FLAG, undefined);

    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("stays on for an empty value", () => {
    vi.stubEnv(FLAG, "");

    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it.each(["false", "0", "off", "no"])("turns off for %o", (value) => {
    vi.stubEnv(FLAG, value);

    expect(isEmailVerificationEnabled()).toBe(false);
  });

  it.each(["  FALSE  ", "Off", "No"])(
    "ignores case and surrounding space in %o",
    (value) => {
      vi.stubEnv(FLAG, value);

      expect(isEmailVerificationEnabled()).toBe(false);
    },
  );

  it.each(["true", "1", "on", "yes", "maybe"])(
    "stays on for %o, which is not in the off list",
    (value) => {
      vi.stubEnv(FLAG, value);

      expect(isEmailVerificationEnabled()).toBe(true);
    },
  );

  /**
   * Read per call, not at module load, so flipping the variable takes effect in
   * the running process rather than only in a fresh build.
   */
  it("re-reads the environment on every call", () => {
    vi.stubEnv(FLAG, "false");
    expect(isEmailVerificationEnabled()).toBe(false);

    vi.stubEnv(FLAG, "true");
    expect(isEmailVerificationEnabled()).toBe(true);
  });
});
