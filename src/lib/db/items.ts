import { itemTypeSelect, type ItemTypeSummary } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";

export interface ItemSummary {
  id: string;
  title: string;
  description: string | null;
  /** drives the card's icon and border color */
  type: ItemTypeSummary;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  updatedAt: Date;
}

export interface ItemStats {
  total: number;
  favorites: number;
}

const itemSelect = {
  id: true,
  title: true,
  description: true,
  isFavorite: true,
  isPinned: true,
  updatedAt: true,
  itemType: { select: itemTypeSelect },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
} as const;

/** Pinned items, most recently updated first. */
export async function getPinnedItems(userId: string): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: { updatedAt: "desc" },
    select: itemSelect,
  });

  return items.map(toSummary);
}

export async function getRecentItems(
  userId: string,
  limit: number,
): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: itemSelect,
  });

  return items.map(toSummary);
}

export async function getItemStats(userId: string): Promise<ItemStats> {
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

function toSummary({
  itemType,
  tags,
  ...item
}: {
  itemType: ItemTypeSummary;
  tags: { name: string }[];
} & Omit<ItemSummary, "type" | "tags">): ItemSummary {
  return { ...item, type: itemType, tags: tags.map((tag) => tag.name) };
}
