import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_SIGN_IN_REDIRECT } from "@/auth.config";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password · DevStash",
};

// Reads the session on every request, so it must not be prerendered.
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  // Nothing to recover while signed in — the password can be changed from the
  // account itself once `/profile` exists.
  if (await auth()) {
    redirect(DEFAULT_SIGN_IN_REDIRECT);
  }

  return <ForgotPasswordForm />;
}
