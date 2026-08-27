import { describe, expect, it } from "vitest";

import {
  DEFAULT_EDITOR_PREFERENCES,
  editorPreferencesSchema,
  parseEditorPreferences,
} from "@/lib/validations/editor-preferences";

const VALID = {
  fontSize: 16,
  tabSize: 4,
  wordWrap: false,
  minimap: true,
  theme: "monokai",
} as const;

describe("editorPreferencesSchema", () => {
  it("accepts a complete, offered set", () => {
    const parsed = editorPreferencesSchema.safeParse(VALID);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(VALID);
  });

  it("rejects a font size the dropdown does not offer", () => {
    // 15 is between two offered sizes, so it is not merely out of range.
    expect(
      editorPreferencesSchema.safeParse({ ...VALID, fontSize: 15 }).success,
    ).toBe(false);
  });

  it("rejects a tab size the dropdown does not offer", () => {
    expect(
      editorPreferencesSchema.safeParse({ ...VALID, tabSize: 3 }).success,
    ).toBe(false);
  });

  it("rejects a theme the app has no definition for", () => {
    // Monaco falls back to the light `vs` for a name it does not know, which
    // would light a dark page up — so an unknown name is refused, not stored.
    expect(
      editorPreferencesSchema.safeParse({ ...VALID, theme: "dracula" }).success,
    ).toBe(false);
  });

  it("rejects a partial set rather than filling the gaps", () => {
    // The write path is strict: the client always holds all five, so a missing
    // one means the payload did not come from the settings page.
    const partial: Record<string, unknown> = { ...VALID };
    delete partial.minimap;

    expect(editorPreferencesSchema.safeParse(partial).success).toBe(false);
  });

  it("strips anything beyond the five preferences", () => {
    const parsed = editorPreferencesSchema.parse({
      ...VALID,
      userId: "someone-else",
    });

    expect(parsed).toEqual(VALID);
    expect(parsed).not.toHaveProperty("userId");
  });

  it("rejects a font size sent as a string", () => {
    expect(
      editorPreferencesSchema.safeParse({ ...VALID, fontSize: "16" }).success,
    ).toBe(false);
  });
});

describe("parseEditorPreferences", () => {
  it("reads a stored set back unchanged", () => {
    expect(parseEditorPreferences(VALID)).toEqual(VALID);
  });

  it("falls back to the defaults for a column that was never written", () => {
    expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it.each([["a string"], [42], [true], [[1, 2]]])(
    "falls back to the defaults for %p, which is not an object",
    (value) => {
      expect(parseEditorPreferences(value)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    },
  );

  it("fills in a preference the stored set predates", () => {
    const stored: Record<string, unknown> = { ...VALID };
    delete stored.minimap;

    expect(parseEditorPreferences(stored)).toEqual({
      ...VALID,
      minimap: DEFAULT_EDITOR_PREFERENCES.minimap,
    });
  });

  it("costs only the unreadable preference, not the other four", () => {
    // The whole point of the lenient read: one value a later version wrote, or
    // an older one left behind, must not reset everything else.
    expect(parseEditorPreferences({ ...VALID, theme: "dracula" })).toEqual({
      ...VALID,
      theme: DEFAULT_EDITOR_PREFERENCES.theme,
    });
  });

  it("ignores extra keys in a stored set", () => {
    expect(parseEditorPreferences({ ...VALID, legacy: "x" })).toEqual(VALID);
  });

  it("defaults every preference for an object holding none of them", () => {
    expect(parseEditorPreferences({})).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});
