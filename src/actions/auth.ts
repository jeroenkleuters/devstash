"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { DEFAULT_SIGN_IN_REDIRECT, SIGN_IN_PATH } from "@/auth.config";
import { firstIssueMessage, signInSchema } from "@/lib/validations/auth";
import {
  SIGN_IN_INITIAL_STATE,
  TOO_MANY_ATTEMPTS_CODE,
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

/** The other named one: the window filled up, whatever was submitted. */
const TOO_MANY_ATTEMPTS =
  "Too many sign-in attempts. Wait a few minutes and try again.";

/** Anything else `AuthError` covers is a misconfiguration, not a bad password. */
const SIGN_IN_FAILED = "Could not sign you in. Try again.";

/**
 * `code` is `CredentialsSignin`'s, not `AuthError`'s, and only the subclasses in
 * `src/auth.ts` set a meaningful one — a plain wrong password arrives with the
 * default. Read defensively so an unrecognised code still reads as a rejection.
 */
function credentialsFailure(error: AuthError): {
  error: string;
  rateLimited: boolean;
} {
  const code = "code" in error ? error.code : undefined;

  if (code === UNVERIFIED_EMAIL_CODE) {
    return { error: UNVERIFIED_EMAIL, rateLimited: false };
  }

  if (code === TOO_MANY_ATTEMPTS_CODE) {
    return { error: TOO_MANY_ATTEMPTS, rateLimited: true };
  }

  return { error: INVALID_CREDENTIALS, rateLimited: false };
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
    return { error: firstIssueMessage(parsed.error), email, rateLimited: false };
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
      const failure =
        cause.type === "CredentialsSignin"
          ? credentialsFailure(cause)
          : { error: SIGN_IN_FAILED, rateLimited: false };

      return { ...failure, email };
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
