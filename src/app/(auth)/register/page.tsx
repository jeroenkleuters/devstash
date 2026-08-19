import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DEFAULT_SIGN_IN_REDIRECT } from "@/auth.config";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Create an account · DevStash",
};

// Reads the session on every request, so it must not be prerendered.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // `getCurrentUser` rather than the session alone, for the reason `/sign-in`
  // gives: a token the app has rejected must not bounce off this page.
  if (await getCurrentUser()) {
    redirect(DEFAULT_SIGN_IN_REDIRECT);
  }

  return <RegisterForm />;
}
