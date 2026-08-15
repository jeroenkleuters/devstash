import { prisma } from "@/lib/prisma";

const DEMO_USER_EMAIL = "demo@devstash.io";

/** The account details the sidebar shows. */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
}

/**
 * Resolves the user whose data the app renders. Until NextAuth lands this is
 * always the seeded demo account; the call sites stay the same afterwards.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true, name: true, email: true },
  });

  return user;
}
