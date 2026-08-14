import { Boxes, Folder, FolderHeart, Star } from "lucide-react";

import { collections, items } from "@/lib/mock-data";

export function StatCards() {
  const stats = [
    { label: "Items", value: items.length, Icon: Boxes },
    { label: "Collections", value: collections.length, Icon: Folder },
    {
      label: "Favorite items",
      value: items.filter((item) => item.isFavorite).length,
      Icon: Star,
    },
    {
      label: "Favorite collections",
      value: collections.filter((collection) => collection.isFavorite).length,
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
