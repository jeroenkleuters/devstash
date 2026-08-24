import { ImageCard } from "@/components/items/image-card";
import type { ItemSummary } from "@/lib/db/items";

interface ImageGalleryProps {
  items: ItemSummary[];
  emptyMessage: string;
}

/** `ItemList`'s counterpart for image types — thumbnails rather than rows. */
export function ImageGallery({ items, emptyMessage }: ImageGalleryProps) {
  if (items.length === 0) {
    return <p className="dashboard-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="image-gallery">
      {items.map((item) => (
        <ImageCard key={item.id} item={item} />
      ))}
    </ul>
  );
}
