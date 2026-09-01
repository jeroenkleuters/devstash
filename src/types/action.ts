/**
 * The failed half of the project's `{ success, data, error }` action shape.
 *
 * Named on its own because the helpers in `src/lib/action-guard.ts` produce it
 * without knowing what a successful result of the action they are wrapping
 * looks like.
 */
export type ActionFailure = { success: false; error: string };

/**
 * An action that answers only whether the write happened.
 *
 * The shape a good half of this project's actions already had, written out
 * separately in each of their type modules. The named aliases stay — a caller
 * reading `UpdateAiPreferencesResult` says what it is waiting on — but the
 * union behind them is stated once.
 *
 * Deliberately not applied to the results that carry `data`: `CreateItemResult`
 * and `UpdateItemResult` are structurally identical and kept apart on purpose
 * so the two actions can diverge, and collapsing them onto one generic would
 * undo a decision rather than a duplication.
 */
export type WriteResult = { success: true } | ActionFailure;
