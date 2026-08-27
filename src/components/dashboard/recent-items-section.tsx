import { Clock } from "lucide-react";

import { ItemList } from "@/components/items/item-list";
import { DASHBOARD_RECENT_ITEMS_LIMIT } from "@/constants/pagination";
import { getRecentItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

export async function RecentItemsSection() {
  const userId = await getCurrentUserId();
  const recentItems = userId
    ? await getRecentItems(userId, DASHBOARD_RECENT_ITEMS_LIMIT)
    : [];

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
