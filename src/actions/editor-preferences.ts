"use server";

import { getCurrentUserId, updateEditorPreferences } from "@/lib/db/user";
import { editorPreferencesSchema } from "@/lib/validations/editor-preferences";
import type { UpdateEditorPreferencesResult } from "@/types/editor-preferences";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const MISSING = "Could not save your preferences. Try again.";

/**
 * Stores the account's editor settings.
 *
 * The account comes from the session and never from the payload, so a request
 * can name the preferences it wants but not whose they are.
 *
 * Not rate limited: it is one cheap write with nothing to guess at, matching
 * the item and collection actions rather than the profile ones, which are
 * throttled because each attempt costs bcrypt.
 */
export async function saveEditorPreferences(
  input: unknown,
): Promise<UpdateEditorPreferencesResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = editorPreferencesSchema.safeParse(input);

  if (!parsed.success) {
    // The dropdowns can only produce values the schema accepts, so anything
    // rejected here was not sent by the settings page.
    return { success: false, error: "Those are not valid editor settings." };
  }

  try {
    // False for a session whose account is gone — the same conflation the item
    // and collection writes make, since there is nothing to tell the caller
    // about a row they may not see.
    if (!(await updateEditorPreferences(userId, parsed.data))) {
      return { success: false, error: SIGNED_OUT };
    }
  } catch {
    return { success: false, error: MISSING };
  }

  return { success: true };
}
