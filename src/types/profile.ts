/** What the change-password form renders through `useActionState`. */
export interface ChangePasswordState {
  error: string | null;
  /** Set once, so the form can confirm the change without navigating away. */
  success: boolean;
}

/**
 * Starting state, kept out of the action module for the same reason the sign-in
 * one is: a `"use server"` module may only export async functions, and
 * exporting an object from one fails at module evaluation rather than at build.
 */
export const CHANGE_PASSWORD_INITIAL_STATE: ChangePasswordState = {
  error: null,
  success: false,
};

/** What the delete-account form renders when the deletion does not go through. */
export interface DeleteAccountState {
  error: string | null;
}

export const DELETE_ACCOUNT_INITIAL_STATE: DeleteAccountState = { error: null };
