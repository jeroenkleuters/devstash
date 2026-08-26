import { LANGUAGE_TYPE_SLUGS } from "@/constants/item-types";
import type { Prisma } from "@/generated/prisma/client";
import {
  compareItemTypes,
  itemTypeSelect,
  type ItemTypeSummary,
} from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";
import type { CreateItemInput, UpdateItemInput } from "@/lib/validations/item";
import type { ItemContentType, ItemDetail } from "@/types/item";

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

/**
 * An item of a file type, for the row list `/items/files` shows.
 *
 * A superset of `ItemSummary` rather than a shape of its own, because the row
 * still opens the same drawer and `openItem` takes a summary — the three extra
 * fields are what a row displays and a card does not.
 */
export interface FileItemSummary extends ItemSummary {
  fileName: string | null;
  fileSize: number | null;
  /** When the file was uploaded. `updatedAt` moves when a title is edited. */
  createdAt: Date;
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

/**
 * What a file row needs on top of the shared card fields.
 *
 * Its own select rather than three more columns on `itemSelect`: that one is
 * shared with the dashboard's Pinned and Recent lists, which display none of
 * these.
 */
const fileItemSelect = {
  ...itemSelect,
  fileName: true,
  fileSize: true,
  createdAt: true,
} as const;

/**
 * Every item of a file type, for `/items/files`.
 *
 * Ordered on `createdAt` rather than `updatedAt` — that is the date the row
 * shows, and sorting on a column the list does not display puts the visible
 * dates out of order. Pinned still comes first, as it does everywhere.
 */
/**
 * The items in one collection, for its page.
 *
 * Lives here rather than in `lib/db/collections.ts` because the shape it
 * returns is an item's: `itemSelect` and the mapping that narrows it both
 * belong to this module.
 *
 * `userId` scopes it independently of the collection, so this can never read
 * another account's items even if it is handed a collection id that is not the
 * caller's. Ordered like every other item list — pinned first, then by the date
 * the card itself prints. `ItemCollection.addedAt` records when an item was
 * filed here, but nothing displays it, so sorting on it would look arbitrary.
 */
export async function getCollectionItems(
  userId: string,
  collectionId: string,
): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({
    where: { userId, collections: { some: { collectionId } } },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    select: itemSelect,
  });

  return items.map(toSummary);
}

export async function getFileItemsByType(
  userId: string,
  itemTypeId: string,
): Promise<FileItemSummary[]> {
  const items = await prisma.item.findMany({
    where: { userId, itemTypeId },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    select: fileItemSelect,
  });

  return items.map(({ fileName, fileSize, createdAt, ...item }) => ({
    ...toSummary(item),
    fileName,
    fileSize,
    createdAt,
  }));
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

  return item && toDetail(item);
}

/** One item's stored file, as the download and delete paths need it. */
export interface ItemFile {
  /** The R2 object key — see `createItem` on why the column holds one. */
  key: string;
  name: string;
  size: number | null;
}

/**
 * The file an item carries, or `null` when it has none, does not exist, or
 * belongs to someone else — the same conflation `getItemDetail` makes, and for
 * the same reason.
 */
export async function getItemFile(
  userId: string,
  itemId: string,
): Promise<ItemFile | null> {
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { fileUrl: true, fileName: true, fileSize: true },
  });

  if (!item?.fileUrl) {
    return null;
  }

  return {
    key: item.fileUrl,
    // Every uploaded object is stored with its name; the fallback is only for a
    // row written before this feature existed.
    name: item.fileName ?? "download",
    size: item.fileSize,
  };
}

/**
 * An object confirmed to be in the bucket, ready to hang off a new item.
 *
 * `size` is what R2 reported, which is the only size anyone can vouch for: the
 * upload goes straight from the browser to the bucket, so the app never counts
 * the bytes itself.
 */
export interface NewItemFile {
  key: string;
  name: string;
  size: number | null;
}

/** The resolved type a new item is created as. */
export interface CreateItemType {
  /** `ItemType.id`, read from the database rather than taken from the request. */
  id: string;
  slug: string;
  contentType: ItemContentType;
}

/**
 * Creates one item for the signed-in account, and returns it in the same shape
 * the drawer reads so the caller needs no follow-up fetch.
 *
 * Only the payload field the chosen type owns is written, for the reason
 * `updateItem` spells out — the difference is that the type is being decided
 * here rather than read off the row, so it is the caller's resolved
 * `contentType` that decides, never what the request happened to send. Language
 * is dropped the same way for the types that do not carry one.
 *
 * The file is passed in rather than read off `input`, and is the object the
 * action has already confirmed is in the bucket — `input.file` carries only a
 * key and a name, since the bytes never passed through the app for anything
 * here to have measured. Its `size` is R2's own.
 *
 * `fileUrl` holds the R2 **object key**, not a URL. Nothing in the app ever
 * needs a public one: the file is served through `/api/items/[id]/file`, which
 * is what keeps the bucket private and the fetch same-origin, and both that
 * route and the delete path need the key. Storing a URL would mean parsing the
 * key back out of it on every use.
 */
export async function createItem(
  userId: string,
  type: CreateItemType,
  input: CreateItemInput,
  file: NewItemFile | null,
): Promise<ItemDetail> {
  const stored = type.contentType === "FILE" ? file : null;

  const item = await prisma.item.create({
    data: {
      userId,
      itemTypeId: type.id,
      contentType: type.contentType,
      title: input.title,
      description: input.description,
      content: type.contentType === "TEXT" ? input.content : null,
      url: type.contentType === "URL" ? input.url : null,
      fileUrl: stored?.key ?? null,
      fileName: stored?.name ?? null,
      fileSize: stored?.size ?? null,
      language: LANGUAGE_TYPE_SLUGS.has(type.slug) ? input.language : null,
      // The join is an explicit model, so these are rows rather than a
      // `connect` — each one carries its own `addedAt`. The action has already
      // checked every id belongs to this user.
      collections: {
        create: input.collectionIds.map((collectionId) => ({ collectionId })),
      },
      tags: {
        connectOrCreate: input.tags.map((name) => ({
          where: { userId_name: { userId, name } },
          create: { userId, name },
        })),
      },
    },
    select: itemDetailSelect,
  });

  return toDetail(item);
}

/**
 * Saves the drawer's edit mode. Returns the updated item so the drawer can show
 * what was stored without a second fetch, or `null` if the item does not exist
 * or belongs to someone else — the same conflation `getItemDetail` makes, and
 * for the same reason.
 *
 * Only the payload field the item's `contentType` owns is written. The three
 * are mutually exclusive with no constraint enforcing it (project overview
 * §10), so a crafted request that sent `content` for a link would otherwise
 * store both and break the integrity check in `scripts/test-db.ts`.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<ItemDetail | null> {
  const existing = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: {
      contentType: true,
      collections: { select: { collectionId: true } },
    },
  });

  if (!existing) {
    return null;
  }

  // Only what actually changed. Clearing the lot and recreating it would land
  // the same selection and reset `addedAt` on every collection the item never
  // left, losing when it was filed there.
  const current = new Set(
    existing.collections.map(({ collectionId }) => collectionId),
  );
  const next = new Set(input.collectionIds);
  const removed = [...current].filter((id) => !next.has(id));
  const added = [...next].filter((id) => !current.has(id));

  const item = await prisma.item.update({
    // `userId` narrows a `where` that is already unique, so the row cannot be
    // swapped for another account's between the read above and this write.
    where: { id: itemId, userId },
    data: {
      title: input.title,
      description: input.description,
      language: input.language,
      content: existing.contentType === "TEXT" ? input.content : undefined,
      url: existing.contentType === "URL" ? input.url : undefined,
      collections: {
        deleteMany: removed.length > 0 ? { collectionId: { in: removed } } : [],
        create: added.map((collectionId) => ({ collectionId })),
      },
      tags: {
        // `set: []` drops the item's existing tags before the new ones are
        // attached; the rows themselves stay, since other items may use them.
        set: [],
        connectOrCreate: input.tags.map((name) => ({
          where: { userId_name: { userId, name } },
          create: { userId, name },
        })),
      },
    },
    select: itemDetailSelect,
  });

  return toDetail(item);
}

/**
 * Deletes one item. Answers whether a row actually went, so "already gone" and
 * "someone else's" are the same `false` — the conflation `getItemDetail` and
 * `updateItem` both make, for the same reason.
 *
 * `deleteMany` rather than `delete`: the latter throws `P2025` when the row is
 * no longer there, so a double-click or two tabs racing would surface as a
 * crash instead of as the item being gone. The `count` is what makes this safe
 * to call twice.
 *
 * The item's collection links and its links to tags cascade; the `Tag` rows
 * themselves stay, since they are per-user and other items may carry them.
 */
export async function deleteItem(
  userId: string,
  itemId: string,
): Promise<boolean> {
  // `userId` is in the `where` rather than checked against a prior read, so
  // there is no window in which the row could be swapped for another account's.
  const { count } = await prisma.item.deleteMany({
    where: { id: itemId, userId },
  });

  return count > 0;
}

type ItemDetailRow = Prisma.ItemGetPayload<{ select: typeof itemDetailSelect }>;

function toDetail({
  itemType,
  tags,
  collections,
  createdAt,
  updatedAt,
  ...rest
}: ItemDetailRow): ItemDetail {
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
