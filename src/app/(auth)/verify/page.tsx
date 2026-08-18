import type { Metadata } from "next";

import { VerifyStatusPanel } from "@/components/auth/verify-status";
import { firstParam } from "@/lib/search-params";
import { VERIFY_STATUSES, type VerifyStatus } from "@/types/auth";

export const metadata: Metadata = {
  title: "Verify your email · DevStash",
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
  const params = await searchParams;

  return (
    <VerifyStatusPanel
      status={toStatus(firstParam(params.status))}
      email={firstParam(params.email)}
    />
  );
}
