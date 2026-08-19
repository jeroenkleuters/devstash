import { NextResponse, after } from "next/server";

import { appOrigin } from "@/lib/app-url";
import { issuePasswordReset } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import {
  callerKey,
  rateLimit,
  tooManyAttemptsResponse,
} from "@/lib/rate-limit";
import { firstIssueMessage, forgotPasswordSchema } from "@/lib/validations/auth";

const WINDOW_MS = 60 * 60 * 1000;

/** Per address — enough to recover from a lost email, not to mail-bomb one. */
const PER_EMAIL_LIMIT = 3;

/** Per caller, so one client cannot walk a list of addresses. */
const PER_IP_LIMIT = 3;

/**
 * Said whatever happened. Confirming that an address is registered, or that it
 * has a password to reset, is exactly what an attacker wants from this endpoint.
 */
const GENERIC_RESULT = {
  success: true,
  message: "If that account exists, a reset link is on its way.",
};

/**
 * Starts a password reset. Deliberately not gated on
 * `EMAIL_VERIFICATION_ENABLED`: verification is an optional requirement, but
 * there is no reset without mail, so switching that flag off must not quietly
 * disable the only way back into an account.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`forgot:ip:${callerKey(request)}`, PER_IP_LIMIT, WINDOW_MS),
    rateLimit(`forgot:email:${email}`, PER_EMAIL_LIMIT, WINDOW_MS),
  ]);

  if (!byIp.success || !byEmail.success) {
    return tooManyAttemptsResponse(byIp, byEmail);
  }

  // Read before the response, so the origin cannot be derived from a request
  // that is already on its way out.
  const origin = appOrigin(request);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, passwordHash: true },
  });

  // Nothing to reset for an unknown address, or for a GitHub-only account that
  // never had a password — mailing one a link would hand it a way to set one,
  // which is account linking and not this feature's job. The answer is the same
  // in every case.
  //
  // Deferred rather than awaited: the body says the same thing either way, but
  // waiting on Resend only when there is something to send makes the response
  // time say which addresses are registered. `after` runs it once the answer has
  // already gone out, so both branches leave at the same speed. Nothing here
  // reads the result — a failure is logged inside `issuePasswordReset`, and the
  // caller was never told whether mail went out in the first place.
  if (user?.passwordHash) {
    const { email: to, name } = user;

    after(() => issuePasswordReset({ email: to, name, origin }));
  }

  return NextResponse.json(GENERIC_RESULT);
}
