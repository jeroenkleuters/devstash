"use client";

import { Pin, Star } from "lucide-react";

import { ItemCopyButton } from "@/components/items/item-copy-button";
import { useItemDrawer } from "@/components/items/item-drawer-provider";
import { isCopyableType, TYPE_ICONS } from "@/constants/item-types";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/utils";

interface ItemCardProps {
  item: ItemSummary;
}

/** Row card, border color-coded by item type. Opening it lands in the drawer. */
export function ItemCard({ item }: ItemCardProps) {
  const Icon = TYPE_ICONS[item.type.icon];
  const { openItem } = useItemDrawer();

  return (
    <li className="item-card" data-type={item.type.slug}>
      {/* Stretched over the card rather than wrapping it, so the card keeps its
          markup and box model — and the skeleton, which reuses these classes,
          keeps rendering as a card that cannot be clicked. */}
      <button
        type="button"
        className="item-card-open"
        aria-label={`Open ${item.title}`}
        onClick={() => openItem(item)}
      />

      <span className="item-card-icon">
        {Icon && <Icon size={16} aria-hidden />}
      </span>

      <div className="item-card-body">
        <h3 className="item-card-title">
          {item.title}
          {item.isPinned && (
            <Pin className="item-card-flag" size={13} aria-hidden />
          )}
          {item.isFavorite && (
            <Star
              className="item-card-flag item-card-star"
              size={13}
              fill="currentColor"
              aria-hidden
            />
          )}
        </h3>
        <p className="item-card-description">{item.description}</p>

        {item.tags.length > 0 && (
          <ul className="item-card-tags">
            {item.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
      </div>

      <time className="item-card-date" dateTime={item.updatedAt.toISOString()}>
        {formatShortDate(item.updatedAt)}
      </time>

      {/* File and image items carry an R2 object key, which means nothing on a
          clipboard — so they get no button rather than a dead one. */}
      {isCopyableType(item.type.slug) && (
        <ItemCopyButton itemId={item.id} title={item.title} />
      )}
    </li>
  );
}
