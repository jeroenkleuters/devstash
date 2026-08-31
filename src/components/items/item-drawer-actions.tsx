"use client";

import { Copy, Pencil, Pin, Star } from "lucide-react";
import { toast } from "sonner";

import { setItemFavorite, setItemPinned } from "@/actions/items";
import { ItemDeleteDialog } from "@/components/items/item-delete-dialog";
import { useFlagToggle } from "@/hooks/use-flag-toggle";
import { copyText } from "@/lib/item-copy";
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
  /** Reports a favorite or pin up, so the summary the header reads stays current. */
  onFlagsChanged: (patch: { isFavorite?: boolean; isPinned?: boolean }) => void;
  /** Fires once the item is deleted. */
  onDeleted: () => void;
}

/**
 * The drawer's action bar. Every button in it works.
 *
 * Favorite and Pin are live in view mode and never need edit mode — they act on
 * the flags the card already carried, so neither waits on the detail fetch.
 *
 * Every label sits in `.action-label`, which is `display: none` below the md
 * breakpoint — five labelled buttons do not fit a phone. That also takes the
 * label out of the accessibility tree, which is why each button carries an
 * `aria-label` repeating it; Delete already had one.
 */
export function ItemDrawerActions({
  itemId,
  title,
  isFavorite,
  isPinned,
  detail,
  onEdit,
  onFlagsChanged,
  onDeleted,
}: ItemDrawerActionsProps) {
  // Live from the moment the drawer opens: both flags come off the card, so
  // neither waits on the detail fetch and neither needs edit mode.
  const favorite = useFlagToggle(isFavorite, async (next) => {
    const result = await setItemFavorite(itemId, next);
    if (result.success) onFlagsChanged({ isFavorite: next });
    return result;
  });

  const pin = useFlagToggle(isPinned, async (next) => {
    const result = await setItemPinned(itemId, next);
    if (result.success) onFlagsChanged({ isPinned: next });
    return result;
  });

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
        data-active={favorite.active}
        aria-pressed={favorite.active}
        aria-label="Favorite"
        onClick={favorite.toggle}
      >
        <Star
          size={16}
          fill={favorite.active ? "currentColor" : "none"}
          aria-hidden
        />
        <span className="action-label">Favorite</span>
      </button>

      <button
        type="button"
        className="item-drawer-action"
        data-active={pin.active}
        aria-pressed={pin.active}
        aria-label="Pin"
        onClick={pin.toggle}
      >
        <Pin
          size={16}
          fill={pin.active ? "currentColor" : "none"}
          aria-hidden
        />
        <span className="action-label">Pin</span>
      </button>

      <button
        type="button"
        className="item-drawer-action"
        aria-label="Copy"
        onClick={copy}
        disabled={!copyable}
      >
        <Copy size={16} aria-hidden />
        <span className="action-label">Copy</span>
      </button>

      <div className="item-drawer-actions-end">
        <button
          type="button"
          className="item-drawer-action"
          aria-label="Edit"
          onClick={onEdit}
          // There is nothing to populate the form with until the detail lands.
          disabled={!detail}
        >
          <Pencil size={16} aria-hidden />
          <span className="action-label">Edit</span>
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

