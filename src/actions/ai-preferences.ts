"use server";

import { updateAiPreferences } from "@/lib/db/user";
import { savePreferences } from "@/lib/preferences-action";
import { aiPreferencesSchema } from "@/lib/validations/ai-preferences";
import type { UpdateAiPreferencesResult } from "@/types/ai";

/**
 * Stores whether the account wants AI features offered at all.
 *
 * The first writer to `User.aiPreferences`, which feature 1 created and left
 * with no consumer. Everything it does is `savePreferences`, which carries the
 * session scoping, the strict schema and the dead-session answer the three
 * settings cards share.
 */
export async function saveAiPreferences(
  input: unknown,
): Promise<UpdateAiPreferencesResult> {
  return savePreferences(input, {
    schema: aiPreferencesSchema,
    write: updateAiPreferences,
    // The switch can only produce a boolean, so anything rejected here was not
    // sent by the settings page.
    invalid: "That is not a valid AI setting.",
    failed: "Could not save your AI setting. Try again.",
  });
}
