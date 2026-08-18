/** What the sign-in form renders through `useActionState`. */
export interface SignInState {
  error: string | null;
  /**
   * The address that was submitted. React resets the form once the action
   * settles, so without handing it back a rejected sign-in would clear the
   * field the visitor almost certainly typed correctly.
   */
  email: string;
}

/**
 * The action's starting state lives here rather than beside the action itself:
 * a `"use server"` module may only export async functions, and exporting this
 * object from one fails at module evaluation rather than at build time.
 */
export const SIGN_IN_INITIAL_STATE: SignInState = { error: null, email: "" };
