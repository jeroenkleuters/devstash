"use client";

import { Download, File } from "lucide-react";

import { ItemFlagButton } from "@/components/items/item-flag-button";
import { useItemDrawer } from "@/components/items/item-drawer-provider";
import { FILE_ICONS } from "@/constants/item-types";
import type { FileItemSummary } from "@/lib/db/items";
import { fileExtension } from "@/lib/file-constraints";
import { formatFileSize, formatShortDate } from "@/lib/utils";

interface FileRowProps {
  item: FileItemSummary;
}

/**
 * One file as a row: its icon, name, size, upload date and a download button.
 *
 * The name leads rather than the item's title, which is what a file manager
 * shows and what the spec asks for — the title is a separate field here, so it
 * follows underneath whenever it says something the name does not.
 */
export function FileRow({ item }: FileRowProps) {
  const Icon = FILE_ICONS[fileExtension(item.fileName ?? "")] ?? File;
  const { openItem } = useItemDrawer();

  const name = item.fileName ?? item.title;
  const subtitle = item.title === name ? item.description : item.title;

  return (
    <li className="file-row" data-type={item.type.slug}>
      {/* The same stretched hit target the row and gallery cards use. The
          download link below is a sibling of this button rather than a child of
          it, so a click on the link never reaches it — no `stopPropagation` is
          involved, only the `z-index` that puts the link on top. */}
      <button
        type="button"
        className="item-card-open"
        aria-label={`Open ${name}`}
        onClick={() => openItem(item)}
      />

      <span className="file-row-icon">
        <Icon size={18} aria-hidden />
      </span>

      <div className="file-row-body">
        <h3 className="file-row-name">
          {/* The truncation lives on the text and not on the `h3`: that is a
              flex row, and a bare text node in one is an anonymous item, which
              `text-overflow` does not reach. */}
          <span className="file-row-name-text">{name}</span>
          <ItemFlagButton
            itemId={item.id}
            title={name}
            flag="pin"
            active={item.isPinned}
          />
          <ItemFlagButton
            itemId={item.id}
            title={name}
            flag="favorite"
            active={item.isFavorite}
          />
        </h3>

        {subtitle && <p className="file-row-subtitle">{subtitle}</p>}
      </div>

      <span className="file-row-size">
        {item.fileSize === null ? "—" : formatFileSize(item.fileSize)}
      </span>

      <time className="file-row-date" dateTime={item.createdAt.toISOString()}>
        {formatShortDate(item.createdAt)}
      </time>

      {/* An anchor rather than a button, as the drawer's download is: the
          response carries `Content-Disposition: attachment`, so the browser
          saves the file without the page going anywhere. */}
      <a
        className="file-row-download"
        href={`/api/items/${item.id}/file?download`}
        aria-label={`Download ${name}`}
      >
        <Download size={16} aria-hidden />
      </a>
    </li>
  );
}
