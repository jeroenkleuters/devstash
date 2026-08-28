"use client";

import { useMemo, useState } from "react";

import { FavoriteCollectionRow } from "@/components/favorites/favorite-collection-row";
import { FavoriteItemRow } from "@/components/favorites/favorite-item-row";
import { FavoriteSection } from "@/components/favorites/favorite-section";
import type { CollectionSummary } from "@/lib/db/collections";
import type { ItemSummary } from "@/lib/db/items";
import {
  COLLECTION_SORT_OPTIONS,
  DEFAULT_SORT_KEY,
  ITEM_SORT_OPTIONS,
  sortFavoriteCollections,
  sortFavoriteItems,
  type CollectionSortKey,
  type ItemSortKey,
} from "@/lib/favorites-sort";

interface FavoritesListProps {
  items: ItemSummary[];
  collections: CollectionSummary[];
}

/**
 * Both favorites panels, each with its own sort control.
 *
 * The sorting is client-side, so this is where the page stops being a server
 * component: the two lists arrive as props and are reordered in place with no
 * query, no round trip and no navigation. The controls are per section because
 * the option sets differ — a collection has no item type to sort on.
 */
export function FavoritesList({ items, collections }: FavoritesListProps) {
  const [itemSort, setItemSort] = useState<ItemSortKey>(DEFAULT_SORT_KEY);
  const [collectionSort, setCollectionSort] =
    useState<CollectionSortKey>(DEFAULT_SORT_KEY);

  const sortedItems = useMemo(
    () => sortFavoriteItems(items, itemSort),
    [items, itemSort],
  );

  const sortedCollections = useMemo(
    () => sortFavoriteCollections(collections, collectionSort),
    [collections, collectionSort],
  );

  return (
    <div className="favorites-sections">
      {/* A section with nothing in it is left out rather than rendered as an
          empty panel — the same call `PinnedItemsSection` makes. */}
      {sortedItems.length > 0 && (
        <FavoriteSection
          title="Items"
          count={sortedItems.length}
          action={
            <SortSelect
              label="Sort items by"
              value={itemSort}
              options={ITEM_SORT_OPTIONS}
              onChange={setItemSort}
            />
          }
        >
          {sortedItems.map((item) => (
            <FavoriteItemRow key={item.id} item={item} />
          ))}
        </FavoriteSection>
      )}

      {sortedCollections.length > 0 && (
        <FavoriteSection
          title="Collections"
          count={sortedCollections.length}
          action={
            <SortSelect
              label="Sort collections by"
              value={collectionSort}
              options={COLLECTION_SORT_OPTIONS}
              onChange={setCollectionSort}
            />
          }
        >
          {sortedCollections.map((collection) => (
            <FavoriteCollectionRow
              key={collection.id}
              collection={collection}
            />
          ))}
        </FavoriteSection>
      )}
    </div>
  );
}

interface SortSelectProps<Key extends string> {
  label: string;
  value: Key;
  options: readonly { value: Key; label: string }[];
  onChange: (value: Key) => void;
}

/**
 * A native `select`, as the settings page uses: it keeps the browser's own
 * keyboard, touch and screen-reader behaviour, which a button group would have
 * to reimplement. The label is on the control rather than beside it — the
 * section heading already says which list this orders.
 */
function SortSelect<Key extends string>({
  label,
  value,
  options,
  onChange,
}: SortSelectProps<Key>) {
  return (
    <select
      className="favorite-sort-select"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as Key)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
