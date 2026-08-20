"use client";

import { Copy, Pencil, Pin, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ItemDetail } from "@/types/item";

interface ItemDrawerActionsProps {
  isFavorite: boolean;
  isPinned: boolean;
  /** Absent while the detail is still loading, or if it failed. */
  detail: ItemDetail | null;
  /** Switches the drawer into edit mode. */
  onEdit: () => void;
}

/**
 * The drawer's action bar.
 *
 * Copy and Edit work; Favorite, Pin and Delete each still need a server action
 * and a revalidation story, so they render for the layout and say why they are
 * inert rather than promising something.
 */
export function ItemDrawerActions({
  isFavorite,
  isPinned,
  detail,
  onEdit,
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

        <button
          type="button"
          className="item-drawer-action item-drawer-action-delete"
          disabled
          title={SOON}
          aria-label="Delete item"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

const SOON = "Coming soon";

/**
 * What Copy puts on the clipboard: the item's own payload, whichever of the
 * three mutually exclusive fields its content type fills.
 */
function copyText(detail: ItemDetail) {
  return detail.content || detail.url || detail.fileUrl || null;
}
