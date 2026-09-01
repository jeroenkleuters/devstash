import { SIGNED_OUT } from "@/constants/messages";
import { getCurrentUserId } from "@/lib/db/user";
import type { ActionFailure, WriteResult } from "@/types/action";

/**
 * The opening and closing of nearly every write action: resolve the session,
 * refuse without one, and turn anything thrown into a logged message the caller
 * can put in a toast.
 *
 * The body gets the id and decides what a success looks like, which is what
 * lets one helper serve actions that answer with data and actions that answer
 * with nothing. It also leaves room for the checks that are not shared —
 * `updateItem` refuses a foreign collection id, `deleteItem` removes an R2
 * object first — since those live in the body rather than around it.
 *
 * `label` names the action in the log. Nothing in a `catch` here is recoverable
 * by the visitor (a dropped connection, or a row deleted between the read and
 * the write), so the log is where the detail goes and `failed` is what they
 * see.
 *
 * Lives in `lib/` rather than beside the actions because a `"use server"`
 * module may only export async functions — a helper exported from one would
 * compile and then fail at runtime.
 */
export async function withSession<R>(
  label: string,
  failed: string,
  body: (userId: string) => Promise<R>,
): Promise<R | ActionFailure> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  try {
    return await body(userId);
  } catch (error) {
    console.error(`${label} failed`, error);

    return { success: false, error: failed };
  }
}

/**
 * The narrower shape the flag and delete writes share: one boolean answer,
 * where false means the row was not there.
 *
 * The writes are `updateMany` / `deleteMany` guarded on their `count` with the
 * owner in the `where`, so false covers both "no such row" and "not yours" —
 * which the query does not tell apart, and which is why `missing` is one
 * message rather than two.
 */
export async function writeFlag(
  label: string,
  failed: string,
  missing: string,
  write: (userId: string) => Promise<boolean>,
): Promise<WriteResult> {
  return withSession(label, failed, async (userId) => {
    if (!(await write(userId))) {
      return { success: false, error: missing };
    }

    return { success: true };
  });
}
