"use client";

import { useState } from "react";

import { ItemFlagButton } from "@/components/items/item-flag-button";
import { useItemDrawer } from "@/components/items/item-drawer-provider";
import { TYPE_ICONS } from "@/constants/item-types";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/utils";

interface ImageCardProps {
  item: ItemSummary;
}

/**
 * An item card for the gallery: the image itself, with the title underneath.
 * Opening it lands in the same drawer the row card does.
 */
export function ImageCard({ item }: ImageCardProps) {
  const Icon = TYPE_ICONS[item.type.icon];
  const { openItem } = useItemDrawer();
  const [failed, setFailed] = useState(false);

  return (
    <li className="image-card" data-type={item.type.slug}>
      {/* The same stretched hit target the row card uses, so hover and focus
          land on the card and not on a transparent layer over its text. */}
      <button
        type="button"
        className="item-card-open"
        aria-label={`Open ${item.title}`}
        onClick={() => openItem(item)}
      />

      <div className="image-card-thumb">
        {failed ? (
          <span className="image-card-fallback">
            {Icon && <Icon size={28} aria-hidden />}
          </span>
        ) : (
          // `next/image` cannot serve this: its optimizer fetches the source
          // server-side without the visitor's cookies, and this route answers
          // 401 without a session — the same reason the drawer's preview is a
          // plain `img`. `ItemSummary` carries no `fileUrl`, so a row with no
          // object behind it is caught by `onError` rather than up front, which
          // also covers an object that is gone from the bucket.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="image-card-image"
            src={`/api/items/${item.id}/file`}
            alt={item.description ?? item.title}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>

      <div className="image-card-body">
        <h3 className="image-card-title">
          {item.title}
          <ItemFlagButton
            itemId={item.id}
            title={item.title}
            flag="pin"
            active={item.isPinned}
          />
          <ItemFlagButton
            itemId={item.id}
            title={item.title}
            flag="favorite"
            active={item.isFavorite}
          />
        </h3>

        <time className="image-card-date" dateTime={item.updatedAt.toISOString()}>
          {formatShortDate(item.updatedAt)}
        </time>
      </div>
    </li>
  );
}
