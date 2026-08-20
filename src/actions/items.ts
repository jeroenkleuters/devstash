"use server";

import { getCurrentUserId } from "@/lib/db/user";
import {
  deleteItem as deleteItemRow,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { firstIssueMessage } from "@/lib/validations/auth";
import { updateItemSchema } from "@/lib/validations/item";
import type { DeleteItemResult, UpdateItemResult } from "@/types/item";

/**
 * A session is not the same as a live account: the row can be gone while the
 * JWT still verifies, which is what `getCurrentUserId` returning null means.
 */
const SIGNED_OUT = "Your session has ended. Sign in again.";

/** Covers both "no such item" and "not yours" — the query does not tell them apart. */
const MISSING = "That item no longer exists.";

const FAILED = "Could not save this item. Try again.";

const DELETE_FAILED = "Could not delete this item. Try again.";

/**
 * Saves the item drawer's edit mode.
 *
 * The payload is validated here rather than trusted from the client: the form
 * runs the same schema for its own messages, but that copy is a convenience the
 * caller controls and this one is the rule.
 */
export async function updateItem(
  itemId: string,
  input: unknown,
): Promise<UpdateItemResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = updateItemSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  try {
    const detail = await updateItemRow(userId, itemId, parsed.data);

    if (!detail) {
      return { success: false, error: MISSING };
    }

    return { success: true, data: detail };
  } catch (error) {
    // Nothing here is recoverable by the visitor — a dropped connection, or the
    // item deleted between the ownership read and the write. Log it so it is
    // not lost, and give the drawer something it can put in a toast.
    console.error("updateItem failed", error);
    return { success: false, error: FAILED };
  }
}

/**
 * Deletes an item from the drawer's confirmation dialog.
 *
 * There is nothing to validate beyond the session and the ownership the query
 * enforces — the id is the whole payload, and an id that is not the caller's
 * is answered as missing rather than refused.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  try {
    const deleted = await deleteItemRow(userId, itemId);

    if (!deleted) {
      return { success: false, error: MISSING };
    }

    return { success: true };
  } catch (error) {
    console.error("deleteItem failed", error);
    return { success: false, error: DELETE_FAILED };
  }
}
