import { Boxes, Folder } from "lucide-react";

import { TYPE_ICONS } from "@/constants/item-types";
import { getCollectionStats } from "@/lib/db/collections";
import { getItemStats, getItemTypesWithCounts } from "@/lib/db/items";

interface ProfileUsageProps {
  userId: string;
}

/**
 * What the account holds: the two totals, then every system type with its own
 * count — including the types holding nothing, since a breakdown that hides its
 * empty rows reads as if those types did not exist.
 */
export async function ProfileUsage({ userId }: ProfileUsageProps) {
  const [items, collections, types] = await Promise.all([
    getItemStats(userId),
    getCollectionStats(userId),
    getItemTypesWithCounts(userId),
  ]);

  return (
    <section className="profile-card">
      <h2 className="profile-card-title">Usage Statistics</h2>

      <ul className="stat-cards profile-usage-totals">
        <li data-stat="items" className="stat-card">
          <span className="stat-card-icon">
            <Boxes size={16} aria-hidden />
          </span>
          <span className="stat-card-value">{items.total}</span>
          <span className="stat-card-label">Total Items</span>
        </li>
        <li data-stat="collections" className="stat-card">
          <span className="stat-card-icon">
            <Folder size={16} aria-hidden />
          </span>
          <span className="stat-card-value">{collections.total}</span>
          <span className="stat-card-label">Collections</span>
        </li>
      </ul>

      <h3 className="profile-subheading">Items by Type</h3>

      <ul className="profile-type-list">
        {types.map((type) => {
          const Icon = TYPE_ICONS[type.icon];

          return (
            <li key={type.id} className="profile-type" data-type={type.slug}>
              <span className="profile-type-icon">
                {Icon && <Icon size={16} aria-hidden />}
              </span>
              <span className="profile-type-name">{type.name}</span>
              <span className="profile-type-count">{type.itemCount}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
