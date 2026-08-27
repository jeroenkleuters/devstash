import type { ItemSummary } from "@/lib/db/items";

/**
 * An item search hit: everything a card knows, plus a preview of the payload.
 *
 * Carrying the whole summary rather than a narrower shape is what lets a result
 * open the item drawer directly — `openItem` takes an `ItemSummary`, and the
 * fields cost nothing extra since the same select already returns them.
 *
 * `updatedAt` is an ISO string rather than a `Date` because this crosses the
 * wire as JSON, the same conversion `getItemDetail` makes for the same reason.
 * A caller handing this to `openItem` has to revive it.
 */
export interface SearchItem extends Omit<ItemSummary, "updatedAt"> {
  updatedAt: string;
  /** The head of whichever field this item's type uses for its payload. */
  preview: string | null;
}

/** A collection search hit. Narrower than `CollectionSummary`: a result row
 *  shows a name and a count, not the type ranking a card is colored by. */
export interface SearchCollection {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
}

export interface SearchResults {
  items: SearchItem[];
  collections: SearchCollection[];
}
