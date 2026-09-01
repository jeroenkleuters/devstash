"use server";

import { updateUploadPreferences } from "@/lib/db/user";
import { savePreferences } from "@/lib/preferences-action";
import { uploadPreferencesSchema } from "@/lib/validations/upload-preferences";
import type { UpdateUploadPreferencesResult } from "@/types/upload-preferences";

/**
 * Stores the account's upload rate limit.
 *
 * The schema is what keeps this from being a way around the limit rather than a
 * setting for it: it accepts only the counts and windows the card offers, so
 * the largest thing an account can ask for is the largest thing on the menu.
 *
 * Everything else is `savePreferences`, which carries the session scoping and
 * the dead-session answer the three settings cards share.
 */
export async function saveUploadPreferences(
  input: unknown,
): Promise<UpdateUploadPreferencesResult> {
  return savePreferences(input, {
    schema: uploadPreferencesSchema,
    write: updateUploadPreferences,
    // The dropdowns can only produce values the schema accepts, so anything
    // rejected here was not sent by the settings page.
    invalid: "That is not a valid upload limit.",
    failed: "Could not save your upload limit. Try again.",
  });
}
