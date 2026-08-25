import type { ItemDetail } from "@/types/item";

/**
 * What Copy puts on the clipboard: the item's own payload, whichever of the
 * mutually exclusive fields its content type fills.
 *
 * A file item has nothing to offer — `fileUrl` holds an R2 object key, which
 * means nothing outside the server — so it copies as null and Download is what
 * gets the file out instead. An empty string is treated the same way: there is
 * a field, but nothing in it to put on the clipboard.
 */
export function copyText(detail: ItemDetail): string | null {
  return detail.content || detail.url || null;
}
