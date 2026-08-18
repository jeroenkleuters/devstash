import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DEFAULT_SIGN_IN_REDIRECT } from "@/auth.config";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account · DevStash",
};

// Reads the session on every request, so it must not be prerendered.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await auth()) {
    redirect(DEFAULT_SIGN_IN_REDIRECT);
  }

  return <RegisterForm />;
}
