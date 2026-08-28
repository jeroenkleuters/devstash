import Link from "next/link";
import { Folder } from "lucide-react";

import type { CollectionSummary } from "@/lib/db/collections";
import { formatRelativeDate } from "@/lib/utils";

interface FavoriteCollectionRowProps {
  collection: CollectionSummary;
}

/**
 * One favorited collection as a dense row: a folder icon, its name, how many
 * items it holds and the date.
 *
 * A server component, unlike the item row — this navigates rather than opening
 * the drawer, so it needs no client state. The icon is deliberately the same
 * folder for every collection: a collection has no type of its own, only the
 * types of what is in it.
 */
export function FavoriteCollectionRow({
  collection,
}: FavoriteCollectionRowProps) {
  return (
    <li className="favorite-row">
      {/* Stretched over the row for the same reason the item row's button is,
          rather than wrapping the contents in the anchor. */}
      <Link
        href={`/collections/${collection.id}`}
        className="item-card-open"
        aria-label={`Open ${collection.name}`}
      />

      <span className="favorite-row-icon">
        <Folder size={15} aria-hidden />
      </span>

      <span className="favorite-row-title">{collection.name}</span>

      <span className="favorite-row-badge" data-neutral>
        {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
      </span>

      <time
        className="favorite-row-date"
        dateTime={collection.updatedAt.toISOString()}
      >
        {formatRelativeDate(collection.updatedAt)}
      </time>
    </li>
  );
}
