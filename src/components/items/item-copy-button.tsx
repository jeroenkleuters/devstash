"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { copyText } from "@/lib/item-copy";
import type { ItemDetail } from "@/types/item";

interface ItemCopyButtonProps {
  itemId: string;
  /** Names the item in the button's label, since the card's own is taken. */
  title: string;
}

/** How long the icon stays a check after a successful copy. */
const COPIED_MS = 2000;

const SESSION_ERROR = "Your session has expired. Sign in again.";
const GENERIC_ERROR = "Could not copy this item.";

/**
 * Copies an item's payload straight from the card, without opening the drawer.
 *
 * The card carries no content: `ItemSummary` is deliberately narrow, so this
 * fetches the detail on click rather than every list query pulling full snippet
 * text for rows nobody copies. The cost is a round trip before the toast, which
 * is why the button reports an in-flight state and refuses a second click.
 */
export function ItemCopyButton({ itemId, title }: ItemCopyButtonProps) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Cleared on unmount, or a card scrolled away mid-timeout would set state on
  // a component that is gone.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copy() {
    if (busy) return;
    setBusy(true);

    try {
      const response = await fetch(`/api/items/${itemId}`);

      if (!response.ok) {
        toast.error(response.status === 401 ? SESSION_ERROR : GENERIC_ERROR);
        return;
      }

      const detail = (await response.json()) as ItemDetail;
      const text = copyText(detail);

      if (!text) {
        toast.error("This item has nothing to copy.");
        return;
      }

      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");

      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Covers both halves: an unreachable server, and a clipboard the browser
      // refused — denied permission, or an insecure origin. Neither leaves the
      // text anywhere else to go, so there is no fallback to offer.
      toast.error(GENERIC_ERROR);
    } finally {
      // Runs on every path, so a failure cannot leave the button dead — the
      // defect that stranded the delete dialog and the edit form.
      setBusy(false);
    }
  }

  const Icon = copied ? Check : Copy;

  return (
    /* A sibling of the card's stretched hit target rather than a child of it —
       a button cannot nest in a button, and the `z-index` below is what puts
       this one on top. A click here never reaches the card, so opening the
       drawer needs no `stopPropagation` to prevent. */
    <button
      type="button"
      className="item-card-copy"
      data-copied={copied}
      aria-label={`Copy ${title}`}
      onClick={copy}
      disabled={busy}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
