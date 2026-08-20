import {
  compareItemTypes,
  itemTypeSelect,
  type ItemTypeSummary,
} from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import type { ItemDetail } from "@/types/item";

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

/** An item type plus how many of the user's items carry it. */
export interface ItemTypeWithCount extends ItemTypeSummary {
  itemCount: number;
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

/**
 * Every item of one type, for `/items/[type]`. Pinned first, then most recently
 * updated — the same ordering the dashboard splits across its two sections.
 */
export async function getItemsByType(
  userId: string,
  itemTypeId: string,
): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({
    where: { userId, itemTypeId },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    select: itemSelect,
  });

  return items.map(toSummary);
}

/** Everything the drawer shows on top of what the card already had. */
const itemDetailSelect = {
  ...itemSelect,
  contentType: true,
  content: true,
  url: true,
  fileName: true,
  fileSize: true,
  fileUrl: true,
  language: true,
  createdAt: true,
  collections: {
    select: { collection: { select: { id: true, name: true } } },
    orderBy: { collection: { name: "asc" } },
  },
} as const;

/**
 * One item in full, for the drawer.
 *
 * `userId` is part of the `where` rather than a check on the result, so another
 * account's item reads as missing instead of forbidden — an id nobody may see
 * is never confirmed to exist.
 *
 * Dates leave as ISO strings: this is the one query whose result is serialized
 * to JSON by an API route rather than handed across the RSC boundary, and doing
 * the conversion here keeps the returned value and `ItemDetail` the same shape
 * on both sides of the wire.
 */
export async function getItemDetail(
  userId: string,
  itemId: string,
): Promise<ItemDetail | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: itemDetailSelect,
  });

  if (!item) {
    return null;
  }

  const { itemType, tags, collections, createdAt, updatedAt, ...rest } = item;

  return {
    ...rest,
    type: itemType,
    tags: tags.map((tag) => tag.name),
    collections: collections.map(({ collection }) => collection),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * The system item types the sidebar lists, each with the user's item count.
 * System types are shared (`userId: null`), so only the count is per user.
 */
export async function getItemTypesWithCounts(
  userId: string,
): Promise<ItemTypeWithCount[]> {
  const types = await prisma.itemType.findMany({
    where: { isSystem: true },
    select: {
      ...itemTypeSelect,
      _count: { select: { items: { where: { userId } } } },
    },
  });

  return types
    .map(({ _count, ...type }) => ({ ...type, itemCount: _count.items }))
    .sort(compareItemTypes);
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
