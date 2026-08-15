import Link from "next/link";
import { Star } from "lucide-react";

import { TYPE_ICONS } from "@/constants/item-types";
import type { CollectionSummary } from "@/lib/db/collections";

interface CollectionCardProps {
  collection: CollectionSummary;
}

/** Card is color-coded by the type the collection holds most of. */
export function CollectionCard({ collection }: CollectionCardProps) {
  const [primaryType] = collection.types;

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
        <p className="collection-card-count">
          {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
        </p>
        <p className="collection-card-description">{collection.description}</p>

        <p className="collection-card-types">
          {collection.types.map((type) => {
            const Icon = TYPE_ICONS[type.icon];

            return Icon ? (
              <Icon
                key={type.id}
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
