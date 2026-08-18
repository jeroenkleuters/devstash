import type { Metadata } from "next";

import { ResetLinkProblem } from "@/components/auth/reset-link-problem";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { checkPasswordResetToken } from "@/lib/password-reset";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Choose a new password · DevStash",
};

// Reads the query string and the token behind it on every request.
export const dynamic = "force-dynamic";

/**
 * Where the emailed link lands. It only *checks* the token — the row is spent
 * by `POST /api/auth/reset-password` once a new password has been submitted —
 * so nothing is thrown away by a render, a prefetch or a reload.
 *
 * Deliberately reachable while signed in, unlike `/sign-in` and
 * `/forgot-password`: someone with a session on this device may well be
 * resetting the password they could not remember on another one.
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = firstParam(params.token);

  if (!token) {
    return <ResetLinkProblem state="invalid" />;
  }

  const state = await checkPasswordResetToken(token);

  if (state !== "valid") {
    return <ResetLinkProblem state={state} />;
  }

  return <ResetPasswordForm token={token} />;
}
