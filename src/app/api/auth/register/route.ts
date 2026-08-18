import { hash } from "bcryptjs";
import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
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

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hash(password, PASSWORD_SALT_ROUNDS),
      },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ success: true, data: user }, { status: 201 });
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
