import { z } from "zod";

const MINUTE = 60 * 1000;

/**
 * How many uploads an account may authorise in one window.
 *
 * A fixed set rather than a free number, and that is the whole design. This is
 * not a convenience setting like font size: it is the guard that stops an
 * account filling the R2 bucket, which the app has no quota of its own for. An
 * open field would mean the limit only ever binds someone who chooses to be
 * bound. Offering a set instead keeps the ceiling in the app's hands while
 * still putting the number in the account's — the largest count over the
 * shortest window is the most anyone can ask for, and it is stated here rather
 * than left to whatever a request happens to name.
 */
export const UPLOAD_COUNTS = [30, 60, 120] as const;

/** Windows the count is measured over, in milliseconds. */
export const UPLOAD_WINDOWS = [15 * MINUTE, 60 * MINUTE, 24 * 60 * MINUTE] as const;

export type UploadCount = (typeof UPLOAD_COUNTS)[number];
export type UploadWindow = (typeof UPLOAD_WINDOWS)[number];

/**
 * A type alias rather than an interface, and that is load-bearing: this goes
 * into a Prisma `Json` column, whose input type wants an index signature, and
 * TypeScript infers one for an alias but never for an interface.
 */
export type UploadPreferences = {
  limit: UploadCount;
  windowMs: UploadWindow;
};

/**
 * What an account gets before it has ever touched the settings card — and what
 * a column holding nothing readable falls back to, field by field.
 *
 * These are the numbers `POST /api/upload` was hardcoded to before this was
 * configurable, so an account that changes nothing is limited exactly as it was.
 */
export const DEFAULT_UPLOAD_PREFERENCES: UploadPreferences = {
  limit: 30,
  windowMs: 15 * MINUTE,
};

const limitSchema = z.literal(UPLOAD_COUNTS);
const windowSchema = z.literal(UPLOAD_WINDOWS);

/**
 * What a write must satisfy. Strict on purpose: a request naming a count the
 * dropdown does not offer is a bad request, not something to quietly correct.
 *
 * It is also the ceiling. Anything this refuses never reaches the column, so
 * the route cannot be handed a limit the app did not offer.
 */
export const uploadPreferencesSchema = z.object({
  limit: limitSchema,
  windowMs: windowSchema,
});

/**
 * The lenient counterpart, for reading the `User.uploadPreferences` column.
 *
 * A JSON column is untyped at the boundary — it comes back as `unknown`, and may
 * hold null (never saved), a partial object (saved before a preference existed)
 * or something a later version wrote. Each field falls back on its own, so one
 * unreadable value costs that one preference rather than resetting both.
 *
 * This is the second half of the ceiling, and the more important half: it is
 * what a value written *around* the app — a hand-edited row, a restored backup
 * from a version offering different numbers — is held to. A stored limit of
 * 100000 is not clamped to the largest offered count, it is refused and falls
 * back to the default, because a number outside the set says the value did not
 * come from here.
 */
const storedUploadPreferencesSchema = z.object({
  limit: limitSchema.catch(DEFAULT_UPLOAD_PREFERENCES.limit),
  windowMs: windowSchema.catch(DEFAULT_UPLOAD_PREFERENCES.windowMs),
});

/** Reads whatever the column holds into a complete, usable set. */
export function parseUploadPreferences(value: unknown): UploadPreferences {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_UPLOAD_PREFERENCES;
  }

  const parsed = storedUploadPreferencesSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_UPLOAD_PREFERENCES;
}

/** "15 minutes", "1 hour", "24 hours" — how a window is named on screen. */
export function uploadWindowLabel(windowMs: number): string {
  const minutes = Math.round(windowMs / MINUTE);

  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = Math.round(minutes / 60);

  return hours === 1 ? "1 hour" : `${hours} hours`;
}
