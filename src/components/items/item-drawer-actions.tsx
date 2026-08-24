"use client";

import { Copy, Pencil, Pin, Star } from "lucide-react";
import { toast } from "sonner";

import { ItemDeleteDialog } from "@/components/items/item-delete-dialog";
import type { ItemDetail } from "@/types/item";

interface ItemDrawerActionsProps {
  /** The item the bar acts on, known before its detail lands. */
  itemId: string;
  title: string;
  isFavorite: boolean;
  isPinned: boolean;
  /** Absent while the detail is still loading, or if it failed. */
  detail: ItemDetail | null;
  /** Switches the drawer into edit mode. */
  onEdit: () => void;
  /** Fires once the item is deleted. */
  onDeleted: () => void;
}

/**
 * The drawer's action bar.
 *
 * Copy, Edit and Delete work; Favorite and Pin each still need a server action
 * and a revalidation story, so they render for the layout and say why they are
 * inert rather than promising something.
 */
export function ItemDrawerActions({
  itemId,
  title,
  isFavorite,
  isPinned,
  detail,
  onEdit,
  onDeleted,
}: ItemDrawerActionsProps) {
  const copyable = detail ? copyText(detail) : null;

  async function copy() {
    if (!copyable) return;

    try {
      await navigator.clipboard.writeText(copyable);
      toast.success("Copied to clipboard");
    } catch {
      // Denied permission, or an insecure origin — the clipboard is the only
      // place this could have gone, so there is no fallback to offer.
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="item-drawer-actions">
      <button
        type="button"
        className="item-drawer-action item-drawer-action-favorite"
        data-active={isFavorite}
        disabled
        title={SOON}
      >
        <Star
          size={16}
          fill={isFavorite ? "currentColor" : "none"}
          aria-hidden
        />
        Favorite
      </button>

      <button
        type="button"
        className="item-drawer-action"
        data-active={isPinned}
        disabled
        title={SOON}
      >
        <Pin size={16} fill={isPinned ? "currentColor" : "none"} aria-hidden />
        Pin
      </button>

      <button
        type="button"
        className="item-drawer-action"
        onClick={copy}
        disabled={!copyable}
      >
        <Copy size={16} aria-hidden />
        Copy
      </button>

      <div className="item-drawer-actions-end">
        <button
          type="button"
          className="item-drawer-action"
          onClick={onEdit}
          // There is nothing to populate the form with until the detail lands.
          disabled={!detail}
        >
          <Pencil size={16} aria-hidden />
          Edit
        </button>

        {/* Deletable as soon as the drawer is open: unlike Edit, this needs no
            field from the detail, only the id the card already carried. */}
        <ItemDeleteDialog
          itemId={itemId}
          title={detail?.title ?? title}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}

const SOON = "Coming soon";

/**
 * What Copy puts on the clipboard: the item's own payload, whichever of the
 * mutually exclusive fields its content type fills.
 *
 * A file item has nothing to offer — `fileUrl` holds an R2 object key, which
 * means nothing outside the server — so Copy stays disabled and the drawer's
 * Download button is what gets the file out.
 */
function copyText(detail: ItemDetail) {
  return detail.content || detail.url || null;
}
