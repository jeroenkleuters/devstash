/**
 * What the change-password form renders through `useActionState`. Refusals only:
 * a change that goes through ends the session and redirects to `/sign-in`, so
 * there is no success for the form to render.
 */
export interface ChangePasswordState {
  error: string | null;
}

/**
 * Starting state, kept out of the action module for the same reason the sign-in
 * one is: a `"use server"` module may only export async functions, and
 * exporting an object from one fails at module evaluation rather than at build.
 */
export const CHANGE_PASSWORD_INITIAL_STATE: ChangePasswordState = {
  error: null,
};

/** What the delete-account form renders when the deletion does not go through. */
export interface DeleteAccountState {
  error: string | null;
}

export const DELETE_ACCOUNT_INITIAL_STATE: DeleteAccountState = { error: null };
