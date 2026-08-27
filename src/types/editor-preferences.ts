/**
 * What `updateEditorPreferences` in `src/actions/editor-preferences.ts` answers
 * with. There is no `data` half: the caller sent the whole set and already holds
 * it, so the only thing left to say is whether it was stored.
 */
export type UpdateEditorPreferencesResult =
  | { success: true }
  | { success: false; error: string };
