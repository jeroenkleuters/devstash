import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { appOrigin } from "@/lib/app-url";
import { issueEmailVerification } from "@/lib/email-verification";
import { isEmailVerificationEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { firstIssueMessage, registerSchema } from "@/lib/validations/auth";

// Matches `prisma/seed.ts`, so seeded and registered accounts hash alike.
const PASSWORD_SALT_ROUNDS = 12;

// Prisma's code for a unique constraint violation — here, the email index.
const UNIQUE_CONSTRAINT = "P2002";

function error(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Creates an email/password account. A static segment beats the sibling
 * `[...nextauth]` catch-all, so this owns `/api/auth/register` outright.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return error("Request body must be JSON.", 400);
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return error(firstIssueMessage(parsed.error), 400);
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return error("An account with that email already exists.", 409);
    }

    const verificationRequired = isEmailVerificationEnabled();

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hash(password, PASSWORD_SALT_ROUNDS),
        // With the requirement switched off the address is taken on trust, and
        // recording that now is what keeps switching it back on from locking
        // out everyone who registered in between.
        emailVerified: verificationRequired ? null : new Date(),
      },
      select: { id: true, name: true, email: true },
    });

    // The account exists either way. Undoing it because the mail bounced would
    // free the address for someone else to claim between the two writes, and
    // leaves the visitor with nothing; an unverified account they can resend
    // from is the recoverable failure.
    const emailSent = verificationRequired
      ? await issueEmailVerification({
          email: user.email,
          name: user.name,
          origin: appOrigin(request),
        })
      : false;

    // `verificationRequired` is how the form learns where to send the visitor
    // next, so the flag itself never has to reach the browser.
    return NextResponse.json(
      { success: true, data: { ...user, verificationRequired, emailSent } },
      { status: 201 },
    );
  } catch (cause) {
    // The check above leaves a gap two simultaneous requests can slip through;
    // the unique index is what actually settles it.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === UNIQUE_CONSTRAINT
    ) {
      return error("An account with that email already exists.", 409);
    }

    console.error("Registration failed", cause);

    return error("Could not create the account.", 500);
  }
}
