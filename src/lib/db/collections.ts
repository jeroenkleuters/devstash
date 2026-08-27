import { cache } from "react";

// A value import, not a type one: `PrismaClientKnownRequestError` is checked
// with `instanceof` below.
import { Prisma } from "@/generated/prisma/client";
import { itemTypeSelect, type ItemTypeSummary } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import type {
  CreateCollectionInput,
  UpdateCollectionInput,
} from "@/lib/validations/collection";
import type { CollectionOption } from "@/types/collection";
import type { SearchCollection } from "@/types/search";

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  /** types present in the collection, most common first */
  types: ItemTypeSummary[];
  updatedAt: Date;
}

export interface CollectionStats {
  total: number;
  favorites: number;
}

/** The sidebar's two collection lists. */
export interface SidebarCollections {
  favorites: CollectionSummary[];
  recent: CollectionSummary[];
}

const collectionSelect = {
  id: true,
  name: true,
  description: true,
  isFavorite: true,
  updatedAt: true,
  items: {
    select: {
      item: { select: { itemType: { select: itemTypeSelect } } },
    },
  },
} as const;

/**
 * Every collection the user owns, most recently updated first, each with the
 * item types it holds. `types[0]` is the type it holds most of — the card's
 * color coding.
 *
 * The sidebar, the dashboard grid and the stat cards all narrow this same list,
 * and `cache` memoizes per request, so one render costs one query. Unbounded on
 * purpose: the sidebar needs every favorite, not the most recent few — which is
 * also what makes it exactly what `/collections` renders, unsliced.
 */
export const getCollections = cache(
  async (userId: string): Promise<CollectionSummary[]> => {
    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: collectionSelect,
    });

    return collections.map(toSummary);
  },
);

/** The most recently updated collections — the dashboard's card grid. */
export async function getRecentCollections(
  userId: string,
  limit: number,
): Promise<CollectionSummary[]> {
  const collections = await getCollections(userId);

  return collections.slice(0, limit);
}

/**
 * Every favorite collection plus the most recently updated non-favorites — the
 * sidebar lists them separately, so a favorite never shows up twice.
 */
export async function getSidebarCollections(
  userId: string,
  recentLimit: number,
): Promise<SidebarCollections> {
  const collections = await getCollections(userId);

  return {
    favorites: collections.filter((collection) => collection.isFavorite),
    recent: collections
      .filter((collection) => !collection.isFavorite)
      .slice(0, recentLimit),
  };
}

export async function getCollectionStats(
  userId: string,
): Promise<CollectionStats> {
  const collections = await getCollections(userId);

  return {
    total: collections.length,
    favorites: collections.filter((collection) => collection.isFavorite).length,
  };
}

/**
 * Every collection the user owns as `{ id, name }`, alphabetical — what the
 * item forms' picker lists.
 *
 * Its own narrow query rather than a slice of `getCollections`: that one pulls
 * every item row to rank the types a collection holds, and a picker needs none
 * of it.
 */
export async function getCollectionOptions(
  userId: string,
): Promise<CollectionOption[]> {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/**
 * Whether every one of these collections belongs to this user.
 *
 * Scoping the *item* to its owner is not enough on its own: a crafted payload
 * could name a collection id belonging to another account and file the item
 * into their collection. This is the check that refuses it, and it is the
 * collections' answer to `ownsObjectKey` on an upload key.
 *
 * Expects ids already deduplicated — the schema does that — since the count
 * comparison is what makes an id that matched nothing fail.
 */
export async function ownsAllCollections(
  userId: string,
  collectionIds: string[],
): Promise<boolean> {
  if (collectionIds.length === 0) {
    return true;
  }

  const owned = await prisma.collection.count({
    where: { userId, id: { in: collectionIds } },
  });

  return owned === collectionIds.length;
}

/**
 * One collection, as its own page's heading reads it.
 *
 * `userId` sits in the `where`, so another account's collection comes back
 * `null` rather than forbidden — the same conflation `getItemDetail` makes, so
 * an id nobody may see is never confirmed to exist. The page turns that into a
 * 404, which is also what an id naming nothing at all gets.
 *
 * Runs the shared `collectionSelect`, so the heading gets the item count and
 * the types the collection holds without a second query.
 */
export async function getCollection(
  userId: string,
  collectionId: string,
): Promise<CollectionSummary | null> {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
    select: collectionSelect,
  });

  return collection ? toSummary(collection) : null;
}

/**
 * Creates a collection from the "New Collection" dialog.
 *
 * `userId` is the session's, never the caller's, so a collection can only ever
 * be created for the account that asked for it. It starts empty, which is why
 * the summary it returns carries no types and a count of zero.
 */
export async function createCollection(
  userId: string,
  input: CreateCollectionInput,
): Promise<CollectionSummary> {
  const collection = await prisma.collection.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
    },
    select: collectionSelect,
  });

  return toSummary(collection);
}

/**
 * Renames a collection or rewrites its description, from the edit dialog.
 *
 * `userId` narrows a `where` that is already unique, so the row cannot be
 * swapped for another account's, and there is no ownership read to race with.
 * Answers `null` when nothing matched, so "already gone" and "someone else's"
 * are indistinguishable — the same conflation `getCollection` makes, for the
 * same reason.
 */
export async function updateCollection(
  userId: string,
  collectionId: string,
  input: UpdateCollectionInput,
): Promise<CollectionSummary | null> {
  try {
    const collection = await prisma.collection.update({
      where: { id: collectionId, userId },
      data: {
        name: input.name,
        description: input.description,
      },
      select: collectionSelect,
    });

    return toSummary(collection);
  } catch (error) {
    // P2025 is "record to update not found", which here means the id names
    // nothing or names someone else's row. Anything else is a real failure and
    // belongs to the caller's own catch.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Deletes one collection. Answers whether a row actually went, so "already
 * gone" and "someone else's" are the same `false`.
 *
 * `deleteMany` rather than `delete`: the latter throws `P2025` when the row is
 * no longer there, so a double-click or two tabs racing would surface as a
 * crash instead of as the collection being gone.
 *
 * **The items survive.** Only the `ItemCollection` rows cascade — an `Item`
 * carries no foreign key to a collection, so every item stays exactly where it
 * was and simply stops being in this one.
 */
export async function deleteCollection(
  userId: string,
  collectionId: string,
): Promise<boolean> {
  const { count } = await prisma.collection.deleteMany({
    where: { id: collectionId, userId },
  });

  return count > 0;
}

type CollectionRow = Prisma.CollectionGetPayload<{
  select: typeof collectionSelect;
}>;

/** One row as the cards, the sidebar and the stat counts all read it. */
function toSummary({ items, ...collection }: CollectionRow): CollectionSummary {
  return {
    ...collection,
    itemCount: items.length,
    types: rankTypes(items.map(({ item }) => item.itemType)),
  };
}

/** Deduplicates types, most common first, ties broken by name for stability. */
function rankTypes(types: ItemTypeSummary[]): ItemTypeSummary[] {
  const counts = new Map<string, { type: ItemTypeSummary; count: number }>();

  for (const type of types) {
    const entry = counts.get(type.id);

    if (entry) {
      entry.count += 1;
    } else {
      counts.set(type.id, { type, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.type.name.localeCompare(b.type.name))
    .map((entry) => entry.type);
}

/**
 * Collections matching a search query, most recently updated first.
 *
 * A `null` query browses instead of searching, as `searchItems` does: the
 * filter is dropped and the user's most recent collections come back, which is
 * what the palette lists underneath the items when it opens.
 *
 * Its own narrow select rather than `collectionSelect`, which pulls every item
 * row of every collection just to rank the types it holds — a result row shows
 * a name and a count, so `_count` is the whole of it.
 */
export async function searchCollections(
  userId: string,
  query: string | null,
  limit: number,
): Promise<SearchCollection[]> {
  const match = { contains: query ?? "", mode: "insensitive" } as const;

  const collections = await prisma.collection.findMany({
    // Spread rather than a value, so browsing omits the key instead of passing
    // an empty `OR`, which Prisma reads as "match nothing".
    where: {
      userId,
      ...(query ? { OR: [{ name: match }, { description: match }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { items: true } },
    },
  });

  return collections.map(({ _count, ...collection }) => ({
    ...collection,
    itemCount: _count.items,
  }));
}
