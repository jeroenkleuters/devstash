import { NextResponse } from "next/server";

import { appOrigin } from "@/lib/app-url";
import { issuePasswordReset } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { firstIssueMessage, forgotPasswordSchema } from "@/lib/validations/auth";

const WINDOW_MS = 15 * 60 * 1000;

/** Per address — enough to recover from a lost email, not to mail-bomb one. */
const PER_EMAIL_LIMIT = 3;

/** Per caller, so one client cannot walk a list of addresses. */
const PER_IP_LIMIT = 10;

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
  const byIp = rateLimit(`forgot:ip:${callerKey(request)}`, PER_IP_LIMIT, WINDOW_MS);
  const byEmail = rateLimit(`forgot:email:${email}`, PER_EMAIL_LIMIT, WINDOW_MS);

  if (!byIp.allowed || !byEmail.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(byIp.retryAfter, byEmail.retryAfter)),
        },
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, passwordHash: true },
  });

  // Nothing to reset for an unknown address, or for a GitHub-only account that
  // never had a password — mailing one a link would hand it a way to set one,
  // which is account linking and not this feature's job. The answer is the same
  // in every case.
  if (user?.passwordHash) {
    await issuePasswordReset({
      email: user.email,
      name: user.name,
      origin: appOrigin(request),
    });
  }

  return NextResponse.json(GENERIC_RESULT);
}
