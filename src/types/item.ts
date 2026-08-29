import type { ItemTypeSummary } from "@/lib/db/item-types";

/**
 * Mirrors the `ContentType` enum in the schema. Spelled out rather than imported
 * from the generated client so this module stays safe for a client component to
 * import: adding a member to the enum widens Prisma's union and stops assigning
 * to this one, which is the loud failure rather than silent drift.
 */
export type ItemContentType = "TEXT" | "URL" | "FILE";

/** One collection an item sits in, as the drawer lists them. */
export interface ItemCollectionSummary {
  id: string;
  name: string;
}

/**
 * One item's full detail, shaped as it crosses the wire from
 * `GET /api/items/[id]`. Dates are ISO strings and not `Date`s because JSON has
 * no date type — `formatShortDate` / `formatLongDate` take either.
 */
export interface ItemDetail {
  id: string;
  title: string;
  description: string | null;
  contentType: ItemContentType;
  /** Text content — snippet, prompt, note, command. */
  content: string | null;
  /** The target of a link item. */
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  /** Syntax highlighting hint, shown next to the type. */
  language: string | null;
  /** A book's author. Null for every other type. */
  author: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  type: ItemTypeSummary;
  tags: string[];
  collections: ItemCollectionSummary[];
  createdAt: string;
  updatedAt: string;
}

/**
 * What `createItem` in `src/actions/items.ts` answers with. Structurally the
 * same as `UpdateItemResult` and kept separate anyway: the two actions are free
 * to diverge, and a create result reading `UpdateItemResult` would not.
 */
export type CreateItemResult =
  | { success: true; data: ItemDetail }
  | { success: false; error: string };

/**
 * What `updateItem` in `src/actions/items.ts` answers with — the project's
 * `{ success, data, error }` action shape, narrowed so a successful result
 * always carries the saved item and a failed one always carries a message.
 */
export type UpdateItemResult =
  | { success: true; data: ItemDetail }
  | { success: false; error: string };

/**
 * What `deleteItem` in `src/actions/items.ts` answers with. There is no `data`
 * half: the item is gone, so the only thing left to say is whether it worked.
 */
export type DeleteItemResult =
  | { success: true }
  | { success: false; error: string };

/**
 * What `setItemFavorite` and `setItemPinned` in `src/actions/items.ts` answer
 * with. No `data` half: the caller asked for a value and already knows it, so
 * the only thing left to say is whether it stuck.
 */
export type SetItemFlagResult =
  | { success: true }
  | { success: false; error: string };
