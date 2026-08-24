"use server";

import { creatableType } from "@/constants/item-types";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemFile,
  updateItem as updateItemRow,
} from "@/lib/db/items";
import { deleteFile, ownsObjectKey } from "@/lib/r2";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createItemSchema, updateItemSchema } from "@/lib/validations/item";
import type {
  CreateItemResult,
  DeleteItemResult,
  UpdateItemResult,
} from "@/types/item";

/**
 * A session is not the same as a live account: the row can be gone while the
 * JWT still verifies, which is what `getCurrentUserId` returning null means.
 */
const SIGNED_OUT = "Your session has ended. Sign in again.";

/** Covers both "no such item" and "not yours" — the query does not tell them apart. */
const MISSING = "That item no longer exists.";

const FAILED = "Could not save this item. Try again.";

const DELETE_FAILED = "Could not delete this item. Try again.";

/** The item is kept when its file cannot go — see `deleteItem`. */
const FILE_DELETE_FAILED =
  "Could not delete this item's file, so the item was kept. Try again.";

const CREATE_FAILED = "Could not create this item. Try again.";

/** The slug parsed, but no system type answering to it — an un-seeded database. */
const UNKNOWN_TYPE = "That item type is not available.";

/** An upload key from outside the caller's own prefix — see `ownsObjectKey`. */
const FOREIGN_FILE = "That file does not belong to this account.";

/**
 * Creates an item from the "New Item" dialog.
 *
 * The type arrives as a slug and is resolved here, so `itemTypeId` and the
 * `contentType` that decides which payload field is stored both come from the
 * server. A request naming a type `CREATABLE_TYPES` does not list fails the
 * schema before any of this runs.
 */
export async function createItem(input: unknown): Promise<CreateItemResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = createItemSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  // The schema already refused anything else, so this is a lookup rather than a
  // check — but the content kind has to come from somewhere the caller cannot
  // set, and this is it.
  const creatable = creatableType(parsed.data.typeSlug);

  if (!creatable) {
    return { success: false, error: UNKNOWN_TYPE };
  }

  // The key is the one thing in the payload that names something outside the
  // row being written, so it is checked against the caller's own prefix — a
  // crafted request cannot attach an object it did not upload.
  const { file } = parsed.data;

  if (file && !ownsObjectKey(userId, file.key)) {
    return { success: false, error: FOREIGN_FILE };
  }

  try {
    const type = await getItemTypeBySlug(creatable.slug);

    if (!type) {
      return { success: false, error: UNKNOWN_TYPE };
    }

    const detail = await createItemRow(
      userId,
      { id: type.id, slug: type.slug, contentType: creatable.contentType },
      parsed.data,
    );

    return { success: true, data: detail };
  } catch (error) {
    console.error("createItem failed", error);
    return { success: false, error: CREATE_FAILED };
  }
}

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
 *
 * An item carrying a file loses the object **first**, and keeps its row if that
 * fails. The other order would leave an object nothing points at and no way to
 * find it again; this way a storage outage makes a file item undeletable until
 * it clears, which is the recoverable half of the trade.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: SIGNED_OUT };
  }

  try {
    const file = await getItemFile(userId, itemId);

    if (file) {
      // The key came off the caller's own row, so this holds unless something
      // wrote a key by hand. Refusing beats deleting an object by that name in
      // someone else's prefix.
      if (!ownsObjectKey(userId, file.key)) {
        console.error("deleteItem refused a foreign object key", file.key);
        return { success: false, error: FILE_DELETE_FAILED };
      }

      try {
        await deleteFile(file.key);
      } catch (error) {
        // Caught here rather than below so the message says which half failed:
        // the item is still there, and trying again is worth something.
        console.error("deleteItem could not remove the file", error);
        return { success: false, error: FILE_DELETE_FAILED };
      }
    }

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
