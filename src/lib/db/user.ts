import { cache } from "react";

import { auth } from "@/auth";
import { passwordFingerprint } from "@/lib/password-fingerprint";
import { prisma } from "@/lib/prisma";
import {
  parseEditorPreferences,
  type EditorPreferences,
} from "@/lib/validations/editor-preferences";

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
  /**
   * The account's Monaco settings, already read out of the JSON column. Carried
   * here because the shell needs them on the first render and this query is
   * already being made — see `AppShell`.
   */
  editorPreferences: EditorPreferences;
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
      editorPreferences: true,
    },
  });

  if (!user) {
    return null;
  }

  const { passwordHash, editorPreferences, ...rest } = user;

  // Both null for an account that signs in with GitHub, so it always matches.
  // A token minted before fingerprints existed carries none and is rejected,
  // which is the fail-closed direction: one sign-in, rather than a session the
  // app cannot tell apart from a stale one.
  if (passwordFingerprint(passwordHash) !== (session.user.pwf ?? null)) {
    return null;
  }

  return {
    ...rest,
    hasPassword: passwordHash !== null,
    editorPreferences: parseEditorPreferences(editorPreferences),
  };
});

/** The id alone, for call sites that don't render the account details. */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();

  return user?.id ?? null;
}

/**
 * Replaces the account's editor settings.
 *
 * Takes the whole set rather than a patch: it is five values the client always
 * holds in full, and merging a partial one into whatever the column happens to
 * contain would make the result depend on what was stored rather than on what
 * was sent.
 */
export async function updateEditorPreferences(
  userId: string,
  preferences: EditorPreferences,
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: { id: userId },
    data: { editorPreferences: preferences },
  });

  return count > 0;
}
