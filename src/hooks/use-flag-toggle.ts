"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

/** Shared by the item and collection actions — both answer in this shape. */
type FlagResult = { success: true } | { success: false; error: string };

/** A rejected request, as opposed to a refused write. */
const UNREACHABLE = "Could not reach the server. Try again.";

/**
 * The toggle behind every one of an item's or collection's boolean flags: the
 * drawer's Favorite and Pin, a collection's page and card menu, and an item
 * card's star.
 *
 * The state is optimistic, which is a deliberate break from every other
 * mutation in this app — those await, toast and refresh. A star that waits on a
 * round trip before it moves reads as a click that did not register, so this
 * paints the new value immediately and lets React put it back if the write
 * fails.
 *
 * `router.refresh()` is still needed and runs *inside* the transition: the
 * sidebar's favorites, the dashboard's stat cards and `/favorites` are all
 * server-rendered, and keeping the refresh in the transition is what holds the
 * optimistic value up until the real one arrives instead of flickering through
 * the old one in between.
 *
 * Success is deliberately silent. Every other mutation toasts, but the star is
 * its own confirmation and one toast per click is noise; a failure still says
 * so.
 */
export function useFlagToggle(
  active: boolean,
  save: (next: boolean) => Promise<FlagResult>,
) {
  const [optimistic, setOptimistic] = useOptimistic(active);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !optimistic;

    startTransition(async () => {
      setOptimistic(next);

      // A failed *write* answers `{ success: false }`, but a failed *request*
      // rejects — without this the rejection is unhandled and the control is
      // left mid-transition. The same defect stranded the delete dialog, the
      // edit form and the create form.
      const result = await save(next).catch(() => null);

      if (!result?.success) {
        toast.error(result?.error ?? UNREACHABLE);
        // Nothing to undo by hand: the optimistic value falls back to the prop
        // as the transition ends.
        return;
      }

      router.refresh();
    });
  }

  return { active: optimistic, toggle };
}
