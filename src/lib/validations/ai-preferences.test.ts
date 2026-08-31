import { describe, expect, it } from "vitest";

import {
  aiPreferencesSchema,
  DEFAULT_AI_PREFERENCES,
  parseAiPreferences,
} from "@/lib/validations/ai-preferences";

describe("DEFAULT_AI_PREFERENCES", () => {
  /**
   * Pinned because it is a decision rather than an accident: nothing in this
   * app calls OpenAI in the background, so "enabled" is permission to act on a
   * click. Off by default would make every AI feature look broken to an
   * account that never found the setting.
   */
  it("defaults on", () => {
    expect(DEFAULT_AI_PREFERENCES.enabled).toBe(true);
  });

  it("is itself a valid write", () => {
    expect(aiPreferencesSchema.safeParse(DEFAULT_AI_PREFERENCES).success).toBe(
      true,
    );
  });
});

describe("aiPreferencesSchema", () => {
  it("takes a boolean and refuses anything else", () => {
    expect(aiPreferencesSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(aiPreferencesSchema.safeParse({ enabled: "yes" }).success).toBe(
      false,
    );
    expect(aiPreferencesSchema.safeParse({}).success).toBe(false);
  });
});

describe("parseAiPreferences", () => {
  it("reads a stored set", () => {
    expect(parseAiPreferences({ enabled: false })).toEqual({ enabled: false });
  });

  /**
   * A JSON column is untyped at the boundary — null (never saved), a shape
   * from a later version, or something edited by hand. Each of these costs the
   * preference rather than crashing the request that read the user.
   */
  it("falls back for anything unreadable", () => {
    for (const stored of [null, undefined, "enabled", 42, [], { enabled: 1 }]) {
      expect(parseAiPreferences(stored)).toEqual(DEFAULT_AI_PREFERENCES);
    }
  });

  it("never returns a partial set", () => {
    expect(parseAiPreferences({})).toEqual(DEFAULT_AI_PREFERENCES);
    expect(parseAiPreferences({ somethingElse: true })).toEqual(
      DEFAULT_AI_PREFERENCES,
    );
  });
});
