import { ImageGallery } from "@/components/items/image-gallery";
import { ItemList } from "@/components/items/item-list";
import { getItemsByType } from "@/lib/db/items";

interface TypeItemsProps {
  userId: string;
  typeId: string;
  /** Plural, lower case — "snippets" — for the empty message. */
  label: string;
  /** Render the items as thumbnails rather than rows. */
  gallery: boolean;
}

/** The list behind `/items/[type]`'s Suspense boundary. */
export async function TypeItems({
  userId,
  typeId,
  label,
  gallery,
}: TypeItemsProps) {
  const items = await getItemsByType(userId, typeId);
  const emptyMessage = `No ${label} yet.`;

  if (gallery) {
    return <ImageGallery items={items} emptyMessage={emptyMessage} />;
  }

  return <ItemList items={items} emptyMessage={emptyMessage} />;
}
