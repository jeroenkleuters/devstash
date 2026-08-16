import { cache } from "react";

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
 *
 * `cache` memoizes per request, so the layout and every dashboard section that
 * needs the user share one query instead of repeating it.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> =>
    prisma.user.findUnique({
      where: { email: DEMO_USER_EMAIL },
      select: { id: true, name: true, email: true },
    }),
);

/** The id alone, for call sites that don't render the account details. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();

  return user?.id ?? null;
}
