"use client";

import { useItemDrawer } from "@/components/items/item-drawer-provider";
import { TYPE_ICONS } from "@/constants/item-types";
import type { ItemSummary } from "@/lib/db/items";
import { formatRelativeDate } from "@/lib/utils";

interface FavoriteItemRowProps {
  item: ItemSummary;
}

/**
 * One favorited item as a dense row: its type icon, title, type badge and date.
 *
 * Opening it lands in the same drawer every other item list uses — `openItem`
 * takes an `ItemSummary`, which is why this passes the whole thing rather than
 * an id.
 */
export function FavoriteItemRow({ item }: FavoriteItemRowProps) {
  const Icon = TYPE_ICONS[item.type.icon];
  const { openItem } = useItemDrawer();

  return (
    <li className="favorite-row" data-type={item.type.slug}>
      {/* The stretched hit target the cards and file rows use, so the row keeps
          its own markup and the badge and date are not inside a button. */}
      <button
        type="button"
        className="item-card-open"
        aria-label={`Open ${item.title}`}
        onClick={() => openItem(item)}
      />

      <span className="favorite-row-icon">
        {Icon && <Icon size={15} aria-hidden />}
      </span>

      <span className="favorite-row-title">{item.title}</span>

      <span className="favorite-row-badge">{item.type.name}</span>

      <time className="favorite-row-date" dateTime={item.updatedAt.toISOString()}>
        {formatRelativeDate(item.updatedAt)}
      </time>
    </li>
  );
}
