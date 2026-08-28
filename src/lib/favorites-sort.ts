/**
 * Client-side ordering for the favorites page.
 *
 * The two panels offer different options because a collection has no item type
 * of its own, only the types of what it holds — so the sort keys are separate
 * unions rather than one shared with a member the collection side must ignore.
 *
 * Every comparator sorts a copy: the arrays come from the server as props, and
 * `sort` mutates in place. `Array.prototype.sort` is stable, so ties keep the
 * order the query returned them in, which is most recently updated first.
 */

export type ItemSortKey = "date" | "name-asc" | "name-desc" | "type";
export type CollectionSortKey = "date" | "name-asc" | "name-desc";

interface SortOption<Key> {
  value: Key;
  label: string;
}

export const ITEM_SORT_OPTIONS: readonly SortOption<ItemSortKey>[] = [
  { value: "date", label: "Date" },
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "type", label: "Item type" },
];

export const COLLECTION_SORT_OPTIONS: readonly SortOption<CollectionSortKey>[] =
  [
    { value: "date", label: "Date" },
    { value: "name-asc", label: "Name (A–Z)" },
    { value: "name-desc", label: "Name (Z–A)" },
  ];

/** The default for both panels — the order the queries already return. */
export const DEFAULT_SORT_KEY = "date";

/** Only what the comparators read, so a caller passes a summary as-is. */
interface SortableItem {
  title: string;
  type: { name: string };
  updatedAt: Date;
}

interface SortableCollection {
  name: string;
  updatedAt: Date;
}

/**
 * Case- and accent-insensitive, with the locale pinned rather than left to the
 * viewer's — the same reason `formatShortDate` pins its time zone: one list
 * should not order itself differently for two readers.
 *
 * Descending swaps the arguments rather than negating the result — the two
 * behave identically, ties included, since a stable sort only reorders on a
 * positive comparison and `-0` is not one. Swapping is simply the plainer read.
 */
function byName(a: string, b: string): number {
  return a.localeCompare(b, "en", { sensitivity: "base" });
}

/** Newest first. */
function byDate(a: Date, b: Date): number {
  return b.getTime() - a.getTime();
}

export function sortFavoriteItems<T extends SortableItem>(
  items: readonly T[],
  key: ItemSortKey,
): T[] {
  const sorted = [...items];

  switch (key) {
    case "name-asc":
      return sorted.sort((a, b) => byName(a.title, b.title));
    case "name-desc":
      return sorted.sort((a, b) => byName(b.title, a.title));
    case "type":
      // Grouped by type name, and newest first inside each group — a type on
      // its own says nothing about the order of the items carrying it.
      return sorted.sort(
        (a, b) =>
          byName(a.type.name, b.type.name) || byDate(a.updatedAt, b.updatedAt),
      );
    case "date":
      return sorted.sort((a, b) => byDate(a.updatedAt, b.updatedAt));
  }
}

export function sortFavoriteCollections<T extends SortableCollection>(
  collections: readonly T[],
  key: CollectionSortKey,
): T[] {
  const sorted = [...collections];

  switch (key) {
    case "name-asc":
      return sorted.sort((a, b) => byName(a.name, b.name));
    case "name-desc":
      return sorted.sort((a, b) => byName(b.name, a.name));
    case "date":
      return sorted.sort((a, b) => byDate(a.updatedAt, b.updatedAt));
  }
}
