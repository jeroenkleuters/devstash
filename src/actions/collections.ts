"use server";

import {
  countCollections,
  createCollection as createCollectionRow,
  deleteCollection as deleteCollectionRow,
  setCollectionFavorite as setCollectionFavoriteRow,
  updateCollection as updateCollectionRow,
} from "@/lib/db/collections";
import { withSession, writeFlag } from "@/lib/action-guard";
import { SIGNED_OUT } from "@/constants/messages";
import { getCurrentUser } from "@/lib/db/user";
import { collectionLimitMessage, collectionUsage } from "@/lib/usage-limits";
import { firstIssueMessage } from "@/lib/validations/auth";
import {
  createCollectionSchema,
  updateCollectionSchema,
} from "@/lib/validations/collection";
import type {
  CreateCollectionResult,
  DeleteCollectionResult,
  SetCollectionFavoriteResult,
  UpdateCollectionResult,
} from "@/types/collection";

const CREATE_FAILED = "Could not create this collection. Try again.";
const UPDATE_FAILED = "Could not save this collection. Try again.";
const DELETE_FAILED = "Could not delete this collection. Try again.";
const FAVORITE_FAILED =
  "Could not change this collection's favorite. Try again.";

/**
 * Said for both "no such collection" and "not yours" — the queries do not tell
 * them apart, so an id nobody may see is never confirmed to exist.
 */
const MISSING = "That collection no longer exists.";

/**
 * Creates a collection from the "New Collection" dialog.
 *
 * The owner comes from the session rather than the payload, so the schema has
 * nothing to say about it — there is no `userId` a request could name.
 */
export async function createCollection(
  input: unknown,
): Promise<CreateCollectionResult> {
  // The whole row rather than the id alone: the free-tier cap below needs
  // `isPro`, and `getCurrentUser` is `cache`d, so this costs what the id did.
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: SIGNED_OUT };
  }

  const parsed = createCollectionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  // Pro is unlimited, so the count query is not made at all for one. Two
  // creates in flight can both read one under the cap and both write, taking a
  // free account one over it — the same accepted race `createItem` records.
  if (!user.isPro) {
    const usage = collectionUsage(user.isPro, await countCollections(user.id));

    if (!usage.allowed) {
      return { success: false, error: collectionLimitMessage() };
    }
  }

  try {
    const collection = await createCollectionRow(user.id, parsed.data);

    return { success: true, data: collection };
  } catch (error) {
    console.error("createCollection failed", error);
    return { success: false, error: CREATE_FAILED };
  }
}

/**
 * Saves the edit dialog's name and description.
 *
 * The id travels as its own argument rather than inside the payload, and the
 * owner comes from the session, so a request can only ever edit a collection
 * the caller holds.
 */
export async function updateCollection(
  collectionId: string,
  input: unknown,
): Promise<UpdateCollectionResult> {
  const parsed = updateCollectionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: firstIssueMessage(parsed.error) };
  }

  return withSession<UpdateCollectionResult>(
    "updateCollection",
    UPDATE_FAILED,
    async (userId) => {
      const collection = await updateCollectionRow(
        userId,
        collectionId,
        parsed.data,
      );

      if (!collection) {
        return { success: false, error: MISSING };
      }

      return { success: true, data: collection };
    },
  );
}

/**
 * Deletes a collection, from the confirmation dialog.
 *
 * The items it held are **not** deleted: an `Item` carries no foreign key to a
 * collection, so only the `ItemCollection` links go and every item stays
 * reachable from its type page and the dashboard.
 */
export async function deleteCollection(
  collectionId: string,
): Promise<DeleteCollectionResult> {
  return writeFlag("deleteCollection", DELETE_FAILED, MISSING, (userId) =>
    deleteCollectionRow(userId, collectionId),
  );
}

/**
 * Stars or unstars a collection, from its page or its card's menu.
 *
 * Takes the value asked for rather than flipping the stored one, and the owner
 * comes from the session — the id is the only thing a request names, and it can
 * only ever reach the caller's own row.
 */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetCollectionFavoriteResult> {
  return writeFlag("setCollectionFavorite", FAVORITE_FAILED, MISSING, (userId) =>
    setCollectionFavoriteRow(userId, collectionId, isFavorite),
  );
}
