"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { DEFAULT_SIGN_IN_REDIRECT, SIGN_IN_PATH } from "@/auth.config";
import { firstIssueMessage, signInSchema } from "@/lib/validations/auth";
import {
  SIGN_IN_INITIAL_STATE,
  UNVERIFIED_EMAIL_CODE,
  type SignInState,
} from "@/types/auth";

/**
 * One message for every credentials failure — unknown email, wrong password,
 * OAuth-only account — matching what `authorize` already refuses to distinguish.
 */
const INVALID_CREDENTIALS = "Incorrect email or password.";

/** The single rejection `authorize` does name, once the password has matched. */
const UNVERIFIED_EMAIL =
  "Verify your email before signing in. Check your inbox for the link.";

/** Anything else `AuthError` covers is a misconfiguration, not a bad password. */
const SIGN_IN_FAILED = "Could not sign you in. Try again.";

/**
 * `code` is `CredentialsSignin`'s, not `AuthError`'s, and only the subclass in
 * `src/auth.ts` sets a meaningful one — a plain wrong password arrives with the
 * default. Read defensively so an unrecognised code still reads as a rejection.
 */
function credentialsMessage(error: AuthError): string {
  const code = "code" in error ? error.code : undefined;

  return code === UNVERIFIED_EMAIL_CODE ? UNVERIFIED_EMAIL : INVALID_CREDENTIALS;
}

/**
 * `redirectTo` is handed to Auth.js rather than used directly: its `redirect`
 * callback drops anything pointing off-origin, so a tampered `callbackUrl`
 * cannot turn the form into an open redirect.
 */
function redirectTarget(formData: FormData): string {
  const callbackUrl = formData.get("callbackUrl");

  return typeof callbackUrl === "string" && callbackUrl.length > 0
    ? callbackUrl
    : DEFAULT_SIGN_IN_REDIRECT;
}

export async function signInWithCredentials(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const parsed = signInSchema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error), email };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: redirectTarget(formData),
    });
  } catch (cause) {
    // A successful sign-in leaves through the redirect Next throws, so only an
    // `AuthError` is actually ours to report — everything else has to travel on.
    if (cause instanceof AuthError) {
      return {
        error:
          cause.type === "CredentialsSignin"
            ? credentialsMessage(cause)
            : SIGN_IN_FAILED,
        email,
      };
    }

    throw cause;
  }

  return SIGN_IN_INITIAL_STATE;
}

export async function signInWithGitHub(formData: FormData) {
  await signIn("github", { redirectTo: redirectTarget(formData) });
}

export async function signOutAction() {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
