import { cache } from "react";

import { auth } from "@/auth";
import { passwordFingerprint } from "@/lib/password-fingerprint";
import { prisma } from "@/lib/prisma";

/** The account details the sidebar and the profile page show. */
export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date;
  /**
   * Whether the account can sign in with a password. Derived rather than
   * carried: the hash itself has no business leaving this module, and the only
   * question anything asks is whether changing it is an option at all.
   */
  hasPassword: boolean;
}

/**
 * Resolves the signed-in user, and with them the data the app renders.
 *
 * The session already carries a name and an image, but they are whatever the
 * JWT was minted with; reading the row keeps the app on current values and
 * returns `null` for a token whose account no longer exists.
 *
 * It is also where a session goes stale. JWT sessions cannot be deleted from the
 * server, so a password change would otherwise leave every cookie opened with
 * the old one working for the rest of its 30-day life; comparing the token's
 * fingerprint against the row is what ends them. This is the only place that
 * check can be free — the row is already being read.
 *
 * `cache` memoizes per request, so the layout and every dashboard section that
 * needs the user share one query instead of repeating it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return null;
  }

  const { passwordHash, ...rest } = user;

  // Both null for an account that signs in with GitHub, so it always matches.
  // A token minted before fingerprints existed carries none and is rejected,
  // which is the fail-closed direction: one sign-in, rather than a session the
  // app cannot tell apart from a stale one.
  if (passwordFingerprint(passwordHash) !== (session.user.pwf ?? null)) {
    return null;
  }

  return { ...rest, hasPassword: passwordHash !== null };
});

/** The id alone, for call sites that don't render the account details. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();

  return user?.id ?? null;
}
