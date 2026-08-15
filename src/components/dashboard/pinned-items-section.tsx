import { Pin } from "lucide-react";

import { ItemList } from "@/components/items/item-list";
import { getPinnedItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

export async function PinnedItemsSection() {
  const userId = await getCurrentUserId();
  const pinnedItems = userId ? await getPinnedItems(userId) : [];

  // Nothing pinned — the section stays out of the page entirely.
  if (pinnedItems.length === 0) {
    return null;
  }

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
