import { NextResponse } from "next/server";

import { resetPasswordWithToken } from "@/lib/password-reset";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { firstIssueMessage, resetPasswordSchema } from "@/lib/validations/auth";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Guessing a 32-byte token is not a threat worth counting, so this is only
 * about the bcrypt hash each accepted call costs.
 */
const PER_IP_LIMIT = 20;

/** What a spent, unknown or expired link is told, per outcome. */
const FAILURES: Record<"expired" | "invalid", string> = {
  expired: "That reset link has expired. Request a new one.",
  invalid:
    "That reset link is no longer valid. It may already have been used — request a new one.",
};

function error(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Spends a reset token and writes the new password. */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return error("Request body must be JSON.", 400);
  }

  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return error(firstIssueMessage(parsed.error), 400);
  }

  const byIp = rateLimit(`reset:ip:${callerKey(request)}`, PER_IP_LIMIT, WINDOW_MS);

  if (!byIp.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(byIp.retryAfter) } },
    );
  }

  const outcome = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
  );

  if (outcome !== "reset") {
    // The page checked the token before rendering the form, so reaching this
    // means it lapsed or was spent in between — worth naming, since the way
    // out is a new link rather than a different password.
    return error(FAILURES[outcome], 400);
  }

  return NextResponse.json({ success: true });
}
