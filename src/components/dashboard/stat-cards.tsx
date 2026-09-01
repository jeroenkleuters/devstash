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

  // `href: null` rather than an absent key, so the property exists on every
  // entry and the literal below stays a literal — a widened `string` is not a
  // typed route.
  const stats = [
    {
      stat: "items",
      label: "Items",
      value: items.total,
      Icon: Boxes,
      href: null,
    },
    {
      stat: "collections",
      label: "Collections",
      value: collections.total,
      Icon: Folder,
      href: null,
    },
    {
      stat: "favorite-items",
      label: "Favorite items",
      value: items.favorites,
      Icon: Star,
      // The only card with somewhere to go — the others would each need a
      // filtered listing that does not exist.
      href: "/favorites" as const,
    },
    {
      stat: "favorite-collections",
      label: "Favorite collections",
      value: collections.favorites,
      Icon: FolderHeart,
      href: null,
    },
  ];

  return (
    <ul className="stat-cards">
      {stats.map(({ stat, label, value, Icon, href }) => (
        <li key={stat} data-stat={stat} className="stat-card">
          {/* Stretched over the card rather than wrapping it, so the grid keeps
              its two columns and the icon keeps spanning both rows. */}
          {href && (
            <Link href={href} className="stat-card-open" aria-label={label}>
              <LinkSpinner />
            </Link>
          )}

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
