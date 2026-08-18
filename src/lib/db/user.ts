import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** The account details the sidebar shows. */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/**
 * Resolves the signed-in user, and with them the data the app renders.
 *
 * The session already carries a name and an image, but they are whatever the
 * JWT was minted with; reading the row keeps the app on current values and
 * returns `null` for a token whose account no longer exists.
 *
 * `cache` memoizes per request, so the layout and every dashboard section that
 * needs the user share one query instead of repeating it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true },
  });
});

/** The id alone, for call sites that don't render the account details. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();

  return user?.id ?? null;
}
