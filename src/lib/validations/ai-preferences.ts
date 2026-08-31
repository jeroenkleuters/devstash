import { z } from "zod";

import type { AiPreferences } from "@/types/ai";

/**
 * What an account gets before it has ever touched the settings card — and what
 * a column holding nothing readable falls back to, field by field.
 *
 * **It defaults on.** The argument both ways is in the AI controls spec, but
 * the short version is that an off-by-default switch makes every AI feature
 * look broken to an account that never found the setting, while on-by-default
 * costs nothing until a button is pressed: nothing in this app calls OpenAI in
 * the background, so "enabled" is permission to act on a click, not consent to
 * anything happening on its own.
 *
 * **The condition attached to that argument:** if any AI feature ever runs
 * without a click — auto-tagging on save, say — this default must be revisited
 * in the same change. The counter-argument, that a privacy-affecting default
 * shipped on is a default nobody chose, is real and loses *only* because there
 * is no background processing. The moment content can leave on its own, it wins.
 */
export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  enabled: true,
};

const enabledSchema = z.boolean();

/**
 * What a write must satisfy. Strict on purpose, the same shape
 * `uploadPreferencesSchema` has: a request naming something the settings card
 * does not offer is a bad request, not something to quietly correct.
 */
export const aiPreferencesSchema = z.object({
  enabled: enabledSchema,
});

/**
 * The lenient counterpart, for reading the `User.aiPreferences` column.
 *
 * A JSON column is untyped at the boundary — it comes back as `unknown`, and
 * may hold null (never saved), a partial object (saved before a preference
 * existed) or something a later version wrote. Each field falls back on its
 * own, so one unreadable value costs that one preference rather than resetting
 * the object. Today there is one field, which makes the shape look like
 * ceremony; it is the shape the second field will need.
 */
const storedAiPreferencesSchema = z.object({
  enabled: enabledSchema.catch(DEFAULT_AI_PREFERENCES.enabled),
});

/** Reads whatever the column holds into a complete, usable set. */
export function parseAiPreferences(value: unknown): AiPreferences {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_AI_PREFERENCES;
  }

  const parsed = storedAiPreferencesSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_AI_PREFERENCES;
}
