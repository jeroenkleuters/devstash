import { ItemCard } from "@/components/items/item-card";
import type { Item } from "@/lib/mock-data";

interface ItemListProps {
  items: Item[];
  emptyMessage: string;
}

export function ItemList({ items, emptyMessage }: ItemListProps) {
  if (items.length === 0) {
    return <p className="dashboard-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="item-list">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </ul>
  );
}
