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

/**
 * The `code` carried by the error `authorize` throws for an account whose email
 * is still unverified. Shared so the sign-in action can tell that rejection
 * apart from a wrong password without importing the error class itself.
 */
export const UNVERIFIED_EMAIL_CODE = "email_unverified";

/**
 * Every state `/verify` renders. The first two come from registration, the
 * rest from `GET /api/auth/verify` after it has spent the token.
 */
export const VERIFY_STATUSES = [
  "sent",
  "send-failed",
  "verified",
  "already",
  "expired",
  "invalid",
] as const;

export type VerifyStatus = (typeof VERIFY_STATUSES)[number];
