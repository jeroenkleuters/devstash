import { Boxes, Folder, FolderHeart, Star } from "lucide-react";

import { getCollectionStats } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";
import { items } from "@/lib/mock-data";

export async function StatCards() {
  const userId = await getCurrentUserId();
  // Item counts stay on mock data until items are wired up to the database.
  const collections = userId
    ? await getCollectionStats(userId)
    : { total: 0, favorites: 0 };

  const stats = [
    { label: "Items", value: items.length, Icon: Boxes },
    { label: "Collections", value: collections.total, Icon: Folder },
    {
      label: "Favorite items",
      value: items.filter((item) => item.isFavorite).length,
      Icon: Star,
    },
    {
      label: "Favorite collections",
      value: collections.favorites,
      Icon: FolderHeart,
    },
  ];

  return (
    <ul className="stat-cards">
      {stats.map(({ label, value, Icon }) => (
        <li key={label} className="stat-card">
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
