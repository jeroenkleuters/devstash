import { prisma } from "@/lib/prisma";

/** The item type metadata a collection card needs to render its icons. */
export interface CollectionType {
  id: string;
  /** URL segment used by /items/[type], also the CSS `data-type` value */
  slug: string;
  name: string;
  /** lucide-react icon name */
  icon: string;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  /** types present in the collection, most common first */
  types: CollectionType[];
  updatedAt: Date;
}

export interface CollectionStats {
  total: number;
  favorites: number;
}

const collectionTypeSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
} as const;

/**
 * Collections ordered by most recently updated, each with the item types it
 * holds. `types[0]` is the type it holds most of — the card's color coding.
 */
export async function getRecentCollections(
  userId: string,
  limit: number,
): Promise<CollectionSummary[]> {
  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      description: true,
      isFavorite: true,
      updatedAt: true,
      items: {
        select: {
          item: { select: { itemType: { select: collectionTypeSelect } } },
        },
      },
    },
  });

  return collections.map(({ items, ...collection }) => ({
    ...collection,
    itemCount: items.length,
    types: rankTypes(items.map(({ item }) => item.itemType)),
  }));
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

/** Deduplicates types, most common first, ties broken by name for stability. */
function rankTypes(types: CollectionType[]): CollectionType[] {
  const counts = new Map<string, { type: CollectionType; count: number }>();

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
