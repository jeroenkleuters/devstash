import { SIGNED_OUT } from "@/constants/messages";
import { getCurrentUserId } from "@/lib/db/user";
import type { WriteResult } from "@/types/action";
import type { z } from "zod";

/**
 * The whole of a "save this settings card" action.
 *
 * The three of them — AI, editor and upload preferences — were the same fifty
 * lines three times over, down to the comments, differing only in the schema,
 * the column they write and two message strings. This is that function once.
 *
 * Three rules it carries, each of which was stated in all three copies:
 *
 * - **The account comes from the session and never from the payload**, so a
 *   request can name the setting it wants but not whose it is.
 * - **The schema is strict**, which is what keeps a partial object out of the
 *   `Json` column. The lenient reader on the way back out exists for values
 *   written *around* the app, not as a licence to write half a set through it.
 * - **`false` from the write is answered as a dead session**, the same
 *   conflation the item and collection writes make — there is nothing to tell
 *   the caller about a row they may not see.
 *
 * Not rate limited: one cheap write with nothing to guess at, matching the item
 * and collection actions rather than the profile ones, which are throttled
 * because each attempt costs a bcrypt.
 *
 * Lives in `lib/` because a `"use server"` module may only export async
 * functions; each action file keeps a thin wrapper that names its own strings.
 */
export async function savePreferences<T>(
  input: unknown,
  options: {
    schema: { safeParse: (value: unknown) => z.ZodSafeParseResult<T> };
    write: (userId: string, preferences: T) => Promise<boolean>;
    /** Only reachable off the settings card, whose controls cannot produce it. */
    invalid: string;
    failed: string;
  },
): Promise<WriteResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = options.schema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: options.invalid };
  }

  try {
    if (!(await options.write(userId, parsed.data))) {
      return { success: false, error: SIGNED_OUT };
    }
  } catch {
    return { success: false, error: options.failed };
  }

  return { success: true };
}
