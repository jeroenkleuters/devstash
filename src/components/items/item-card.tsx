import { Pin, Star } from "lucide-react";

import { TYPE_ICONS } from "@/constants/item-types";
import { ITEM_TYPES_BY_ID } from "@/lib/item-types";
import type { Item } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/utils";

interface ItemCardProps {
  item: Item;
}

/** Row card, border color-coded by item type. Opening it lands in the drawer. */
export function ItemCard({ item }: ItemCardProps) {
  const type = ITEM_TYPES_BY_ID[item.itemTypeId];
  const Icon = type && TYPE_ICONS[type.icon];

  return (
    <li className="item-card" data-type={type?.slug}>
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

      <time className="item-card-date" dateTime={item.updatedAt}>
        {formatShortDate(item.updatedAt)}
      </time>
    </li>
  );
}
