import Link from "next/link";
import { Boxes, Folder, FolderHeart, Star } from "lucide-react";

import { LinkSpinner } from "@/components/layout/link-pending";

import { getCollectionStats } from "@/lib/db/collections";
import { getItemStats } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

const EMPTY_STATS = { total: 0, favorites: 0 };

export async function StatCards() {
  const userId = await getCurrentUserId();
  const [items, collections] = userId
    ? await Promise.all([getItemStats(userId), getCollectionStats(userId)])
    : [EMPTY_STATS, EMPTY_STATS];

  // Every card now has a listing behind it, so `href` is always a route. It
  // stays `as const` on each entry rather than being widened: a plain `string`
  // is not a typed route.
  const stats = [
    {
      stat: "items",
      label: "Items",
      value: items.total,
      Icon: Boxes,
      href: "/items" as const,
    },
    {
      stat: "collections",
      label: "Collections",
      value: collections.total,
      Icon: Folder,
      href: "/collections" as const,
    },
    {
      stat: "favorite-items",
      label: "Favorite items",
      value: items.favorites,
      Icon: Star,
      href: "/favorites" as const,
    },
    {
      stat: "favorite-collections",
      label: "Favorite collections",
      value: collections.favorites,
      Icon: FolderHeart,
      href: "/favorite-collections" as const,
    },
  ];

  return (
    <ul className="stat-cards">
      {stats.map(({ stat, label, value, Icon, href }) => (
        <li key={stat} data-stat={stat} className="stat-card">
          {/* Stretched over the card rather than wrapping it, so the grid keeps
              its two columns and the icon keeps spanning both rows. */}
          <Link href={href} className="stat-card-open" aria-label={label}>
            <LinkSpinner />
          </Link>

          <span className="stat-card-icon">
            <Icon size={16} aria-hidden />
          </span>
          <span className="stat-card-value">{value}</span>
          <span className="stat-card-label">{label}</span>
        </li>
      ))}
    </ul>
  );
}
