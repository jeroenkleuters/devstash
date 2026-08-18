import { NextResponse } from "next/server";

import { appOrigin } from "@/lib/app-url";
import { issueEmailVerification } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  firstIssueMessage,
  resendVerificationSchema,
} from "@/lib/validations/auth";

const WINDOW_MS = 15 * 60 * 1000;

/** Per address — enough to recover from a lost email, not to mail-bomb one. */
const PER_EMAIL_LIMIT = 3;

/** Per caller, so one client cannot walk a list of addresses. */
const PER_IP_LIMIT = 10;

/**
 * Said whatever happened. Confirming that an address is registered, or that it
 * is still unverified, is exactly what an attacker wants from this endpoint.
 */
const GENERIC_RESULT = {
  success: true,
  message: "If that account needs verifying, a new link is on its way.",
};

function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  return forwarded?.split(",")[0]?.trim() || "unknown";
}

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

  const parsed = resendVerificationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { email } = parsed.data;
  const byIp = rateLimit(`resend:ip:${callerKey(request)}`, PER_IP_LIMIT, WINDOW_MS);
  const byEmail = rateLimit(`resend:email:${email}`, PER_EMAIL_LIMIT, WINDOW_MS);

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
    select: { name: true, email: true, emailVerified: true, passwordHash: true },
  });

  // Nothing to do for an unknown address, one already verified, or a
  // GitHub-only account that never had a password to verify against — but the
  // answer is the same in every case.
  if (user?.passwordHash && !user.emailVerified) {
    await issueEmailVerification({
      email: user.email,
      name: user.name,
      origin: appOrigin(request),
    });
  }

  return NextResponse.json(GENERIC_RESULT);
}
