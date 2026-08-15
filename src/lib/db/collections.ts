import { itemTypeSelect, type ItemTypeSummary } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";

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
 * Collections ordered by most recently updated, each with the item types it
 * holds. `types[0]` is the type it holds most of — the card's color coding.
 */
export async function getRecentCollections(
  userId: string,
  limit: number,
): Promise<CollectionSummary[]> {
  return findCollections({ userId }, limit);
}

/**
 * Every favorite collection plus the most recently updated non-favorites — the
 * sidebar lists them separately, so a favorite never shows up twice.
 */
export async function getSidebarCollections(
  userId: string,
  recentLimit: number,
): Promise<SidebarCollections> {
  const [favorites, recent] = await Promise.all([
    findCollections({ userId, isFavorite: true }),
    findCollections({ userId, isFavorite: false }, recentLimit),
  ]);

  return { favorites, recent };
}

export async function getCollectionStats(
  userId: string,
): Promise<CollectionStats> {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

async function findCollections(
  where: { userId: string; isFavorite?: boolean },
  take?: number,
): Promise<CollectionSummary[]> {
  const collections = await prisma.collection.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    select: collectionSelect,
  });

  return collections.map(({ items, ...collection }) => ({
    ...collection,
    itemCount: items.length,
    types: rankTypes(items.map(({ item }) => item.itemType)),
  }));
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
