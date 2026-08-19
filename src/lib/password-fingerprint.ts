import { createHash } from "node:crypto";

/**
 * A marker for "the password this session was opened with", carried on the JWT
 * and re-checked against the account row on every request.
 *
 * Sessions are JWTs rather than database rows, so there is nothing to delete
 * when a password changes — a stolen cookie would otherwise stay usable for the
 * rest of its 30-day life. Deriving the marker from the stored hash means the
 * thing that changes when the password changes is the thing being compared, and
 * it needs no column of its own: a `passwordChangedAt` field would say the same
 * and cost a migration.
 *
 * Truncated because only equality is ever asked of it, and hashed rather than
 * carried whole so the token never holds the bcrypt hash itself.
 */
export function passwordFingerprint(
  passwordHash: string | null,
): string | null {
  if (!passwordHash) {
    return null;
  }

  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}
