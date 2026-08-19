"use server";

import { signOut } from "@/auth";
import { SIGN_IN_PATH } from "@/auth.config";
import {
  changeAccountPassword,
  deleteAccount,
  type ChangePasswordOutcome,
} from "@/lib/account";
import { getCurrentUserId } from "@/lib/db/user";
import { rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema, firstIssueMessage } from "@/lib/validations/auth";
import {
  CHANGE_PASSWORD_INITIAL_STATE,
  type ChangePasswordState,
  type DeleteAccountState,
} from "@/types/profile";

/**
 * Both actions are reachable only with a session, but a session is not the same
 * as a live account: the row can be gone while the JWT still verifies.
 */
const SIGNED_OUT = "Your session has ended. Sign in again.";

/**
 * Each attempt costs two bcrypt hashes, and a stolen session could otherwise
 * guess the current password without limit. Counted per account rather than per
 * IP — it is the account that is under attack, and the caller is known here.
 */
const ATTEMPT_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;

const REFUSALS: Record<Exclude<ChangePasswordOutcome, "changed">, string> = {
  incorrect: "That is not your current password.",
  // Only reachable if the form is posted by an account that has no password —
  // the page does not render it for one.
  "no-password":
    "This account signs in with GitHub, so it has no password to change.",
  "unknown-user": SIGNED_OUT,
};

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: SIGNED_OUT };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error) };
  }

  const attempt = rateLimit(
    `change-password:${userId}`,
    ATTEMPT_LIMIT,
    WINDOW_MS,
  );

  if (!attempt.allowed) {
    return { error: "Too many attempts. Try again later." };
  }

  const outcome = await changeAccountPassword(
    userId,
    parsed.data.currentPassword,
    parsed.data.password,
  );

  if (outcome !== "changed") {
    return { error: REFUSALS[outcome] };
  }

  // Every session opened with the old password is now invalid — `getCurrentUser`
  // compares the token's fingerprint against the row, and the row has moved. The
  // session that made the change is one of them, so it ends here rather than
  // surviving to be turned away on the next navigation. `?reset=1` renders the
  // acknowledgement the reset flow already put on the sign-in page.
  //
  // Throws the redirect that leaves this action, so nothing below it runs.
  await signOut({ redirectTo: `${SIGN_IN_PATH}?reset=1` });

  return CHANGE_PASSWORD_INITIAL_STATE;
}

/**
 * Removes the account and ends the session with it — leaving the JWT in place
 * would keep a cookie pointing at a row that no longer exists.
 */
export async function deleteAccountAction(): Promise<DeleteAccountState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { error: SIGNED_OUT };
  }

  if (!(await deleteAccount(userId))) {
    return { error: SIGNED_OUT };
  }

  // Throws the redirect that leaves this action, so nothing below it runs.
  await signOut({ redirectTo: SIGN_IN_PATH });

  return { error: null };
}
