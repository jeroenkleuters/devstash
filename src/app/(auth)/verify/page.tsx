import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { SIGN_IN_PATH } from "@/auth.config";
import { VerifyStatusPanel } from "@/components/auth/verify-status";
import { isEmailVerificationEnabled } from "@/lib/feature-flags";
import { firstParam } from "@/lib/search-params";
import { VERIFY_STATUSES, type VerifyStatus } from "@/types/auth";

export const metadata: Metadata = {
  title: "Verify your email · DevSquirrel",
};

// Reads the query string on every request, and follows a write that just
// happened in the verify route — never a prerender.
export const dynamic = "force-dynamic";

function toStatus(value: string | undefined): VerifyStatus {
  return VERIFY_STATUSES.includes(value as VerifyStatus)
    ? (value as VerifyStatus)
    : // Where registration lands, and the safe reading of a mangled URL.
      "sent";
}

/**
 * Reports the outcome of a verification attempt and offers a new link. It never
 * touches the token itself — `GET /api/auth/verify` spends it and redirects
 * here with the result, keeping the mutation out of a render.
 *
 * Deliberately reachable while signed in: a stale link should still explain
 * itself rather than bounce to the dashboard.
 */
export default async function VerifyPage({
  searchParams,
}: PageProps<"/verify">) {
  // With the requirement switched off the page has no job left: every state it
  // reports resolves to "just sign in", and the resend form it offers on four
  // of them would promise a link that is never sent.
  if (!isEmailVerificationEnabled()) {
    redirect(SIGN_IN_PATH);
  }

  const params = await searchParams;

  return (
    <VerifyStatusPanel
      status={toStatus(firstParam(params.status))}
      email={firstParam(params.email)}
    />
  );
}
