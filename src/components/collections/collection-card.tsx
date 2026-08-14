import Link from "next/link";
import { Star } from "lucide-react";

import { TYPE_ICONS } from "@/constants/item-types";
import { ITEM_TYPES_BY_ID } from "@/lib/item-types";
import type { Collection } from "@/lib/mock-data";

interface CollectionCardProps {
  collection: Collection;
}

/** Card is color-coded by the type the collection holds most of. */
export function CollectionCard({ collection }: CollectionCardProps) {
  const primaryType = ITEM_TYPES_BY_ID[collection.primaryTypeId];

  return (
    <li>
      <Link
        href={`/collections/${collection.id}`}
        className="collection-card"
        data-type={primaryType?.slug}
      >
        <h3 className="collection-card-name">
          {collection.name}
          {collection.isFavorite && (
            <Star
              className="collection-card-star"
              size={14}
              fill="currentColor"
              aria-hidden
            />
          )}
        </h3>
        <p className="collection-card-count">{collection.itemCount} items</p>
        <p className="collection-card-description">{collection.description}</p>

        <p className="collection-card-types">
          {collection.typeIds.map((typeId) => {
            const type = ITEM_TYPES_BY_ID[typeId];
            const Icon = type && TYPE_ICONS[type.icon];

            return Icon ? (
              <Icon
                key={typeId}
                className="collection-card-type-icon"
                data-type={type.slug}
                size={14}
                aria-hidden
              />
            ) : null;
          })}
        </p>
      </Link>
    </li>
  );
}
