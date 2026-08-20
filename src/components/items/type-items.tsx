import { ItemList } from "@/components/items/item-list";
import { getItemsByType } from "@/lib/db/items";

interface TypeItemsProps {
  userId: string;
  typeId: string;
  /** Plural, lower case — "snippets" — for the empty message. */
  label: string;
}

/** The list behind `/items/[type]`'s Suspense boundary. */
export async function TypeItems({ userId, typeId, label }: TypeItemsProps) {
  const items = await getItemsByType(userId, typeId);

  return <ItemList items={items} emptyMessage={`No ${label} yet.`} />;
}
