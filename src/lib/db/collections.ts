import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { itemTypeSelect, type ItemTypeSummary } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import type { CreateCollectionInput } from "@/lib/validations/collection";
import type { CollectionOption } from "@/types/collection";

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
 * purpose: the sidebar needs every favorite, not the most recent few.
 */
const getCollections = cache(
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
