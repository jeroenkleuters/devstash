import { FileList } from "@/components/items/file-list";
import { ImageGallery } from "@/components/items/image-gallery";
import { ItemList } from "@/components/items/item-list";
import { uploadKindFor } from "@/constants/item-types";
import { getFileItemsByType, getItemsByType } from "@/lib/db/items";

/**
 * How a type's items are laid out. One value rather than a flag per layout, so
 * "gallery and files at once" cannot be expressed.
 */
export type ItemsLayout = "list" | "gallery" | "files";

/**
 * Which layout a type takes. `uploadKindFor` is already the app's answer to
 * what a type holds — both file types are `ContentType.FILE`, so the column
 * cannot say whether it is a picture or a document.
 */
export function itemsLayoutFor(slug: string): ItemsLayout {
  switch (uploadKindFor(slug)) {
    case "image":
      return "gallery";
    case "file":
      return "files";
    default:
      return "list";
  }
}

interface TypeItemsProps {
  userId: string;
  typeId: string;
  /** Plural, lower case — "snippets" — for the empty message. */
  label: string;
  layout: ItemsLayout;
}

/**
 * The list behind `/items/[type]`'s Suspense boundary.
 *
 * The fork happens before the query and not after it: a file row needs columns
 * a card does not, so the two branches run different queries and return
 * different shapes.
 */
export async function TypeItems({
  userId,
  typeId,
  label,
  layout,
}: TypeItemsProps) {
  const emptyMessage = `No ${label} yet.`;

  if (layout === "files") {
    const items = await getFileItemsByType(userId, typeId);
    return <FileList items={items} emptyMessage={emptyMessage} />;
  }

  const items = await getItemsByType(userId, typeId);

  if (layout === "gallery") {
    return <ImageGallery items={items} emptyMessage={emptyMessage} />;
  }

  return <ItemList items={items} emptyMessage={emptyMessage} />;
}
