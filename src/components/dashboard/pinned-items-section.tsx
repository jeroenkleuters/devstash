import { Pin } from "lucide-react";

import { ItemList } from "@/components/items/item-list";
import { items } from "@/lib/mock-data";

export function PinnedItemsSection() {
  const pinnedItems = items.filter((item) => item.isPinned);

  return (
    <section className="dashboard-section">
      <h2 className="dashboard-section-title">
        <Pin size={16} aria-hidden />
        Pinned
      </h2>
      <ItemList items={pinnedItems} emptyMessage="Nothing pinned yet." />
    </section>
  );
}
