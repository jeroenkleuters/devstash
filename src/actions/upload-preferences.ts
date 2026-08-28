"use server";

import { getCurrentUserId, updateUploadPreferences } from "@/lib/db/user";
import { uploadPreferencesSchema } from "@/lib/validations/upload-preferences";
import type { UpdateUploadPreferencesResult } from "@/types/upload-preferences";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const FAILED = "Could not save your upload limit. Try again.";

/**
 * Stores the account's upload rate limit.
 *
 * The account comes from the session and never from the payload, so a request
 * can name the limit it wants but not whose it is.
 *
 * The schema is what keeps this from being a way around the limit rather than a
 * setting for it: it accepts only the counts and windows the card offers, so
 * the largest thing an account can ask for is the largest thing on the menu.
 *
 * Not rate limited: it is one cheap write with nothing to guess at, matching
 * the item and collection actions rather than the profile ones, which are
 * throttled because each attempt costs bcrypt.
 */
export async function saveUploadPreferences(
  input: unknown,
): Promise<UpdateUploadPreferencesResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = uploadPreferencesSchema.safeParse(input);

  if (!parsed.success) {
    // The dropdowns can only produce values the schema accepts, so anything
    // rejected here was not sent by the settings page.
    return { success: false, error: "That is not a valid upload limit." };
  }

  try {
    // False for a session whose account is gone — the same conflation the item
    // and collection writes make, since there is nothing to tell the caller
    // about a row they may not see.
    if (!(await updateUploadPreferences(userId, parsed.data))) {
      return { success: false, error: SIGNED_OUT };
    }
  } catch {
    return { success: false, error: FAILED };
  }

  return { success: true };
}
