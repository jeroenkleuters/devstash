"use server";

import { updateEditorPreferences } from "@/lib/db/user";
import { savePreferences } from "@/lib/preferences-action";
import { editorPreferencesSchema } from "@/lib/validations/editor-preferences";
import type { UpdateEditorPreferencesResult } from "@/types/editor-preferences";

/**
 * Stores the account's editor settings.
 *
 * Everything it does is `savePreferences`, which carries the session scoping,
 * the strict schema and the dead-session answer the three settings cards share.
 */
export async function saveEditorPreferences(
  input: unknown,
): Promise<UpdateEditorPreferencesResult> {
  return savePreferences(input, {
    schema: editorPreferencesSchema,
    write: updateEditorPreferences,
    // The dropdowns can only produce values the schema accepts, so anything
    // rejected here was not sent by the settings page.
    invalid: "Those are not valid editor settings.",
    failed: "Could not save your preferences. Try again.",
  });
}
