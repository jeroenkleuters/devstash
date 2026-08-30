import { compare, hash } from "bcryptjs";

import { getUserFileKeys } from "@/lib/db/items";
import { passwordResetIdentifier } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { deleteFiles } from "@/lib/r2";

/** Matches `prisma/seed.ts`, the register route and the reset flow. */
const PASSWORD_SALT_ROUNDS = 12;

/**
 * Why a password change was refused, or that it went through.
 *
 * `no-password` is the OAuth-only case: an account created through GitHub has
 * nothing to compare against, and giving it one here would be account linking.
 */
export type ChangePasswordOutcome =
  | "changed"
  | "incorrect"
  | "no-password"
  | "unknown-user";

/**
 * Replaces the password of an account that is already signed in, which is why
 * this asks for the current one rather than a mailed token: possession of the
 * session is not on its own proof of knowing the password it was opened with.
 */
export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    return "unknown-user";
  }

  if (!user.passwordHash) {
    return "no-password";
  }

  if (!(await compare(currentPassword, user.passwordHash))) {
    return "incorrect";
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hash(newPassword, PASSWORD_SALT_ROUNDS) },
  });

  return "changed";
}

/**
 * Removes the account and everything it owns.
 *
 * Items, collections, tags, custom item types, linked OAuth accounts and
 * sessions all carry `onDelete: Cascade` from `User`, so the row takes them
 * with it. Two things do not follow, exactly as `scripts/prune-users.ts`
 * records: system item types survive because their `userId` is null — which is
 * what we want — while `VerificationToken` has no relation to `User` at all.
 * Its rows are keyed on the email string, under two identifiers now that
 * password resets share the table, so they are cleared here by hand.
 *
 * The uploaded objects go too, and the order there is deliberate: **the row is
 * deleted first and R2 is swept afterwards, best effort.** The alternative —
 * objects first, refusing the deletion when the store is unreachable, which is
 * what `deleteItem` does — was rejected here because it lets a vendor outage
 * block someone from leaving. That is a bad answer to an erasure request and a
 * worse one under GDPR than a logged orphan. The account always goes.
 *
 * The consequence is accepted rather than hidden: an R2 failure still leaves
 * orphans. `npm run r2:sweep` is what reclaims them.
 *
 * Returns false when the row is already gone, which a second submission of the
 * confirmation dialog would find.
 */
export async function deleteAccount(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return false;
  }

  // BEFORE anything is deleted, and this is the whole of the bug it fixes:
  // `Item` cascades from `User`, so the rows holding these keys go with the
  // account and collecting them afterwards is impossible. Resist moving the
  // read down next to its use.
  const keys = await getUserFileKeys(userId);

  // Before the user row, while the address they are keyed on is still readable.
  await prisma.verificationToken.deleteMany({
    where: {
      identifier: { in: [user.email, passwordResetIdentifier(user.email)] },
    },
  });

  // `deleteMany` rather than `delete`, which throws when the row is already
  // gone — two submissions of the dialog would otherwise race, and the loser
  // would answer with a 500 rather than an already-deleted account.
  const { count } = await prisma.user.deleteMany({ where: { id: userId } });

  // Already gone, so the submission that did delete it has already swept. Its
  // keys would delete harmlessly a second time; the log noise would not.
  if (count === 0) {
    return false;
  }

  if (keys.length > 0) {
    // Swallowed deliberately: erasure must not depend on R2 being reachable.
    // The message names the count and the recovery command, because a line
    // reading only "R2 delete failed" is one nobody can act on.
    await deleteFiles(userId, keys).catch((cause: unknown) => {
      console.error(
        `Account ${userId} deleted, but ${keys.length} R2 object(s) were not. Run \`npm run r2:sweep\`.`,
        cause,
      );
    });
  }

  return true;
}
