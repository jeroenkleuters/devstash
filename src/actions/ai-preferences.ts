"use server";

import { getCurrentUserId, updateAiPreferences } from "@/lib/db/user";
import { aiPreferencesSchema } from "@/lib/validations/ai-preferences";
import type { UpdateAiPreferencesResult } from "@/types/ai";

const SIGNED_OUT = "Your session has ended. Sign in again.";
const FAILED = "Could not save your AI setting. Try again.";

/**
 * Stores whether the account wants AI features offered at all.
 *
 * The first writer to `User.aiPreferences`, which feature 1 created and left
 * with no consumer.
 *
 * The account comes from the session and never from the payload, so a request
 * can name the setting it wants but not whose it is. The strict schema is what
 * keeps a partial object out of the column — the lenient reader exists for
 * values written *around* the app, not as a licence to write half a set through
 * it.
 *
 * Not rate limited: one cheap write with nothing to guess at, matching the item,
 * collection and editor-preference actions rather than the profile ones, which
 * are throttled because each attempt costs a bcrypt.
 */
export async function saveAiPreferences(
  input: unknown,
): Promise<UpdateAiPreferencesResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = aiPreferencesSchema.safeParse(input);

  if (!parsed.success) {
    // The switch can only produce a boolean, so anything rejected here was not
    // sent by the settings page.
    return { success: false, error: "That is not a valid AI setting." };
  }

  try {
    // False for a session whose account is gone — the same conflation the item
    // and collection writes make, since there is nothing to tell the caller
    // about a row they may not see.
    if (!(await updateAiPreferences(userId, parsed.data))) {
      return { success: false, error: SIGNED_OUT };
    }
  } catch {
    return { success: false, error: FAILED };
  }

  return { success: true };
}
