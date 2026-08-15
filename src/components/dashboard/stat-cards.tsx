import { Boxes, Folder, FolderHeart, Star } from "lucide-react";

import { getCollectionStats } from "@/lib/db/collections";
import { getItemStats } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

const EMPTY_STATS = { total: 0, favorites: 0 };

export async function StatCards() {
  const userId = await getCurrentUserId();
  const [items, collections] = userId
    ? await Promise.all([getItemStats(userId), getCollectionStats(userId)])
    : [EMPTY_STATS, EMPTY_STATS];

  const stats = [
    { stat: "items", label: "Items", value: items.total, Icon: Boxes },
    {
      stat: "collections",
      label: "Collections",
      value: collections.total,
      Icon: Folder,
    },
    {
      stat: "favorite-items",
      label: "Favorite items",
      value: items.favorites,
      Icon: Star,
    },
    {
      stat: "favorite-collections",
      label: "Favorite collections",
      value: collections.favorites,
      Icon: FolderHeart,
    },
  ];

  return (
    <ul className="stat-cards">
      {stats.map(({ stat, label, value, Icon }) => (
        <li key={stat} data-stat={stat} className="stat-card">
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
