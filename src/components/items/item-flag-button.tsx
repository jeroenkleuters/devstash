"use client";

import { Pin, Star } from "lucide-react";

import { setItemFavorite, setItemPinned } from "@/actions/items";
import { useFlagToggle } from "@/hooks/use-flag-toggle";

type ItemFlag = "favorite" | "pin";

/**
 * The two flags differ only in their icon, their action and what they are
 * called, so they share one component rather than two near-identical ones.
 */
const FLAGS = {
  favorite: {
    Icon: Star,
    save: setItemFavorite,
    on: (title: string) => `Unfavorite ${title}`,
    off: (title: string) => `Favorite ${title}`,
  },
  pin: {
    Icon: Pin,
    save: setItemPinned,
    on: (title: string) => `Unpin ${title}`,
    off: (title: string) => `Pin ${title}`,
  },
} as const;

interface ItemFlagButtonProps {
  itemId: string;
  /** Names the item in the button's label, since the card's own is taken. */
  title: string;
  flag: ItemFlag;
  active: boolean;
}

/**
 * A star or a pin on an item card — controls now, not the read-only indicators
 * they used to be, so an item can be favorited or pinned without being opened.
 *
 * Siblings of the card's stretched hit target rather than children of it: a
 * button cannot nest in a button, and the `z-index` in the stylesheet is what
 * puts these on top. A click here never reaches the card, so there is no
 * `stopPropagation` involved.
 */
export function ItemFlagButton({
  itemId,
  title,
  flag,
  active: initial,
}: ItemFlagButtonProps) {
  const { Icon, save, on, off } = FLAGS[flag];

  const { active, toggle } = useFlagToggle(initial, (next) =>
    save(itemId, next),
  );

  return (
    <button
      type="button"
      className={`item-flag item-flag-${flag}`}
      data-active={active}
      aria-pressed={active}
      aria-label={active ? on(title) : off(title)}
      onClick={toggle}
    >
      <Icon size={13} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
