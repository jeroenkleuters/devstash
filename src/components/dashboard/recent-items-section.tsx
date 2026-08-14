import { Clock } from "lucide-react";

import { ItemList } from "@/components/items/item-list";
import { items } from "@/lib/mock-data";

const RECENT_ITEM_LIMIT = 10;

export function RecentItemsSection() {
  const recentItems = [...items]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_ITEM_LIMIT);

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">
        <Clock size={16} aria-hidden />
        Recent
      </h2>
      <ItemList items={recentItems} emptyMessage="No items yet." />
    </section>
  );
}
