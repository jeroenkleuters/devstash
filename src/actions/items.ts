"use server";

import { creatableType, isProType } from "@/constants/item-types";
import { ownsAllCollections } from "@/lib/db/collections";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { withSession, writeFlag } from "@/lib/action-guard";
import { SIGNED_OUT } from "@/constants/messages";
import { getCurrentUser } from "@/lib/db/user";
import {
  countItems,
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemFile,
  setItemFavorite as setItemFavoriteRow,
  setItemPinned as setItemPinnedRow,
  updateItem as updateItemRow,
  type NewItemFile,
} from "@/lib/db/items";
import { MAX_UPLOAD_BYTES } from "@/lib/file-constraints";
import { deleteFile, headFile, ownsObjectKey } from "@/lib/r2";
import { formatFileSize } from "@/lib/utils";
import { itemLimitMessage, itemUsage } from "@/lib/usage-limits";
import { firstIssueMessage } from "@/lib/validations/auth";
import { createItemSchema, updateItemSchema } from "@/lib/validations/item";
import type {
  CreateItemResult,
  DeleteItemResult,
  SetItemFlagResult,
  UpdateItemResult,
} from "@/types/item";

/** Covers both "no such item" and "not yours" — the query does not tell them apart. */
const MISSING = "That item no longer exists.";

const FAILED = "Could not save this item. Try again.";

const DELETE_FAILED = "Could not delete this item. Try again.";

const FAVORITE_FAILED = "Could not change this item's favorite. Try again.";

const PIN_FAILED = "Could not change this item's pin. Try again.";

/** The item is kept when its file cannot go — see `deleteItem`. */
const FILE_DELETE_FAILED =
  "Could not delete this item's file, so the item was kept. Try again.";

const CREATE_FAILED = "Could not create this item. Try again.";

/** The slug parsed, but no system type answering to it — an un-seeded database. */
const UNKNOWN_TYPE = "That item type is not available.";

/** An upload key from outside the caller's own prefix — see `ownsObjectKey`. */
const FOREIGN_FILE = "That file does not belong to this account.";

/** A collection id naming someone else's — see `ownsAllCollections`. */
const FOREIGN_COLLECTION =
  "One of those collections does not belong to this account.";

/** A free account choosing a type only Pro may create — see `PRO_TYPE_SLUGS`. */
const PRO_TYPE_REQUIRED =
  "Files, images and books are a Pro feature. Upgrade in Settings.";

/** A key with nothing behind it: never uploaded, or already cleaned up. */
const MISSING_UPLOAD = "That upload is no longer there. Try choosing it again.";

/** Only reachable if the signed length did not hold — see `createItem`. */
const OVERSIZE_UPLOAD = `That file is larger than ${formatFileSize(
  MAX_UPLOAD_BYTES,
)}.`;

/**
 * Creates an item from the "New Item" dialog.
 *
 * The type arrives as a slug and is resolved here, so `itemTypeId` and the
 * `contentType` that decides which payload field is stored both come from the
 * server. A request naming a type `CREATABLE_TYPES` does not list fails the
 * schema before any of this runs.
 */
export async function createItem(input: unknown): Promise<CreateItemResult> {
  // The whole row rather than the id alone: the free-tier gates below need
  // `isPro`, and `getCurrentUser` is `cache`d, so this costs exactly what the
  // id did.
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: SIGNED_OUT };
  }

  const userId = user.id;

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

  // Refused before the upload key is even looked at: a free account choosing a
  // Pro type should be told which feature it needs, not which field is wrong.
  if (!user.isPro && isProType(creatable.slug)) {
    return { success: false, error: PRO_TYPE_REQUIRED };
  }

  // Pro is unlimited, so the count query is not made at all for one.
  //
  // Two creates in flight can both read one under the cap and both write,
  // taking a free account one over it. Postgres has no cheap constraint for
  // that — the only exact fix is a transaction around a count and an insert —
  // and one item over the cap is not worth paying for on every create.
  if (!user.isPro) {
    const usage = itemUsage(user.isPro, await countItems(userId));

    if (!usage.allowed) {
      return { success: false, error: itemLimitMessage() };
    }
  }

  // The key is the one thing in the payload that names something outside the
  // row being written, so it is checked against the caller's own prefix — a
  // crafted request cannot attach an object it did not upload.
  const { file } = parsed.data;

  if (file && !ownsObjectKey(userId, file.key)) {
    return { success: false, error: FOREIGN_FILE };
  }

  try {
    // Scoping the item to its owner says nothing about the collections it names
    // — those are the other account's rows, so they get their own check.
    if (!(await ownsAllCollections(userId, parsed.data.collectionIds))) {
      return { success: false, error: FOREIGN_COLLECTION };
    }

    const type = await getItemTypeBySlug(creatable.slug);

    if (!type) {
      return { success: false, error: UNKNOWN_TYPE };
    }

    const stored = await confirmUpload(file);

    if (typeof stored === "string") {
      return { success: false, error: stored };
    }

    const detail = await createItemRow(
      userId,
      { id: type.id, slug: type.slug, contentType: creatable.contentType },
      parsed.data,
      stored,
    );

    return { success: true, data: detail };
  } catch (error) {
    console.error("createItem failed", error);
    return { success: false, error: CREATE_FAILED };
  }
}

/**
 * Confirms that an upload actually reached the bucket, and reports how big it
 * turned out to be — or the reason it cannot be attached.
 *
 * This is the second half of the size cap, and the half that does not depend on
 * a signature holding. The file is PUT straight to R2 by the browser, so the
 * app has never seen a byte of it: `content-length` is signed into the upload
 * URL, which is what should make an over-size body impossible, and this asks the
 * bucket what it really stored anyway. That answer is also what the item keeps,
 * so `fileSize` is never the client's word for it.
 *
 * A string is a message for the caller; `null` means there was no file to
 * confirm, which is the ordinary case for every type but File and Image.
 */
async function confirmUpload(
  file: { key: string; name: string } | null,
): Promise<NewItemFile | string | null> {
  if (!file) {
    return null;
  }

  const object = await headFile(file.key);

  if (!object) {
    return MISSING_UPLOAD;
  }

  if (object.size !== null && object.size > MAX_UPLOAD_BYTES) {
    return OVERSIZE_UPLOAD;
  }

  return { key: file.key, name: file.name, size: object.size };
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
  const parsed = updateItemSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  return withSession<UpdateItemResult>("updateItem", FAILED, async (userId) => {
    // Same rule as create: the item is the caller's, the collections it names
    // are not necessarily.
    if (!(await ownsAllCollections(userId, parsed.data.collectionIds))) {
      return { success: false, error: FOREIGN_COLLECTION };
    }

    const detail = await updateItemRow(userId, itemId, parsed.data);

    if (!detail) {
      return { success: false, error: MISSING };
    }

    return { success: true, data: detail };
  });
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
  return withSession<DeleteItemResult>(
    "deleteItem",
    DELETE_FAILED,
    async (userId) => {
      const file = await getItemFile(userId, itemId);

      if (file) {
        // The key came off the caller's own row, so this holds unless something
        // wrote a key by hand. Refusing beats deleting an object by that name
        // in someone else's prefix.
        if (!ownsObjectKey(userId, file.key)) {
          console.error("deleteItem refused a foreign object key", file.key);
          return { success: false, error: FILE_DELETE_FAILED };
        }

        try {
          await deleteFile(file.key);
        } catch (error) {
          // Caught here rather than by the wrapper so the message says which
          // half failed: the item is still there, and trying again is worth
          // something.
          console.error("deleteItem could not remove the file", error);
          return { success: false, error: FILE_DELETE_FAILED };
        }
      }

      const deleted = await deleteItemRow(userId, itemId);

      if (!deleted) {
        return { success: false, error: MISSING };
      }

      return { success: true };
    },
  );
}

/**
 * Stars or unstars an item, from the drawer or straight from its card.
 *
 * The value is what the caller asked for rather than a flip of what is stored,
 * so two clicks racing settle on one answer. `userId` comes from the session,
 * so the id is the only thing a request names and it can only ever reach the
 * caller's own row.
 */
export async function setItemFavorite(
  itemId: string,
  isFavorite: boolean,
): Promise<SetItemFlagResult> {
  return writeFlag("setItemFavorite", FAVORITE_FAILED, MISSING, (userId) =>
    setItemFavoriteRow(userId, itemId, isFavorite),
  );
}

/** Pins or unpins an item, from the drawer. Same rules as the favorite above. */
export async function setItemPinned(
  itemId: string,
  isPinned: boolean,
): Promise<SetItemFlagResult> {
  return writeFlag("setItemPinned", PIN_FAILED, MISSING, (userId) =>
    setItemPinnedRow(userId, itemId, isPinned),
  );
}
