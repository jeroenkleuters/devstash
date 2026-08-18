import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_SIGN_IN_REDIRECT } from "@/auth.config";
import { SignInForm } from "@/components/auth/sign-in-form";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Sign in · DevStash",
};

// Reads the session on every request, so it must not be prerendered.
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  if (await auth()) {
    redirect(DEFAULT_SIGN_IN_REDIRECT);
  }

  const params = await searchParams;

  return (
    <SignInForm
      callbackUrl={firstParam(params.callbackUrl)}
      // NextAuth sends provider failures here rather than to its own error page.
      providerError={firstParam(params.error)}
    />
  );
}
