import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DEFAULT_SIGN_IN_REDIRECT } from "@/auth.config";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getCurrentUser } from "@/lib/db/user";
import { firstParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Sign in · CodeSquirrel",
};

// Reads the session on every request, so it must not be prerendered.
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  // `getCurrentUser` rather than the session alone: a token the app has already
  // rejected — deleted account, superseded password — must land on this form
  // rather than be bounced back to the page that just turned it away.
  if (await getCurrentUser()) {
    redirect(DEFAULT_SIGN_IN_REDIRECT);
  }

  const params = await searchParams;

  return (
    <SignInForm
      callbackUrl={firstParam(params.callbackUrl)}
      // NextAuth sends provider failures here rather than to its own error page.
      providerError={firstParam(params.error)}
      passwordReset={firstParam(params.reset) === "1"}
    />
  );
}
