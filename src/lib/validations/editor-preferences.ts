import { z } from "zod";

/** Sizes the font-size dropdown offers, in px. */
export const FONT_SIZES = [12, 13, 14, 16, 18, 20] as const;

/** Widths the tab-size dropdown offers, in spaces. */
export const TAB_SIZES = [2, 4, 8] as const;

/**
 * Monaco themes the theme dropdown offers.
 *
 * `vs-dark` is Monaco's own; the other two are token maps this app defines at
 * mount (see `src/lib/monaco-themes.ts`) — Monaco ships only `vs`, `vs-dark`,
 * `hc-black` and `hc-light`, so nothing else resolves by name alone.
 */
export const EDITOR_THEMES = ["vs-dark", "monokai", "github-dark"] as const;

export type FontSize = (typeof FONT_SIZES)[number];
export type TabSize = (typeof TAB_SIZES)[number];
export type EditorTheme = (typeof EDITOR_THEMES)[number];

/**
 * A type alias rather than an interface, and that is load-bearing: this goes
 * into a Prisma `Json` column, whose input type wants an index signature, and
 * TypeScript infers one for an alias but never for an interface.
 */
export type EditorPreferences = {
  fontSize: FontSize;
  tabSize: TabSize;
  wordWrap: boolean;
  minimap: boolean;
  theme: EditorTheme;
};

/**
 * What an account gets before it has ever opened the settings page — and what a
 * column holding nothing readable falls back to, field by field.
 *
 * `fontSize` and `tabSize` are the values the editor was hardcoded to before
 * this was configurable, so an existing item looks the same as it did.
 */
export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  theme: "vs-dark",
};

const fontSizeSchema = z.literal(FONT_SIZES);
const tabSizeSchema = z.literal(TAB_SIZES);
const themeSchema = z.enum(EDITOR_THEMES);

/**
 * What a write must satisfy. Strict on purpose: a request naming a font size the
 * dropdown does not offer is a bad request, not something to quietly correct —
 * unlike a *stored* value, which the app has to cope with however it got there.
 */
export const editorPreferencesSchema = z.object({
  fontSize: fontSizeSchema,
  tabSize: tabSizeSchema,
  wordWrap: z.boolean(),
  minimap: z.boolean(),
  theme: themeSchema,
});

/**
 * The lenient counterpart, for reading the `User.editorPreferences` column.
 *
 * A JSON column is untyped at the boundary — it comes back as `unknown`, and may
 * hold null (never saved), a partial object (saved before a preference existed)
 * or something a later version wrote. Each field therefore falls back on its
 * own, so one unreadable value costs that one preference rather than resetting
 * the other four.
 */
const storedEditorPreferencesSchema = z.object({
  fontSize: fontSizeSchema.catch(DEFAULT_EDITOR_PREFERENCES.fontSize),
  tabSize: tabSizeSchema.catch(DEFAULT_EDITOR_PREFERENCES.tabSize),
  wordWrap: z.boolean().catch(DEFAULT_EDITOR_PREFERENCES.wordWrap),
  minimap: z.boolean().catch(DEFAULT_EDITOR_PREFERENCES.minimap),
  theme: themeSchema.catch(DEFAULT_EDITOR_PREFERENCES.theme),
});

/** Reads whatever the column holds into a complete, usable set. */
export function parseEditorPreferences(value: unknown): EditorPreferences {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const parsed = storedEditorPreferencesSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_EDITOR_PREFERENCES;
}
