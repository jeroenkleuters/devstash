import { FileRow } from "@/components/items/file-row";
import type { FileItemSummary } from "@/lib/db/items";

interface FileListProps {
  items: FileItemSummary[];
  emptyMessage: string;
}

/** `ItemList`'s counterpart for file types — one column of rows. */
export function FileList({ items, emptyMessage }: FileListProps) {
  if (items.length === 0) {
    return <p className="dashboard-empty">{emptyMessage}</p>;
  }

  return (
    <ul className="file-list">
      {items.map((item) => (
        <FileRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
