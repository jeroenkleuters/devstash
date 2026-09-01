"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/* Feedback that a click on a link registered, drawn on the link itself.
 *
 * `useLinkStatus` reports the pending state of the nearest ancestor `<Link>`,
 * so both of these only work from inside one — that is the whole contract, and
 * it is why the spinner is a child of the link rather than a prop on it.
 *
 * Every page in the app is `force-dynamic` and there is no `loading.tsx`
 * anywhere, so a navigation always costs a round trip. There is deliberately no
 * delay before the spinner appears: nothing here resolves fast enough to flash,
 * and a delay would leave a gap where the icon has gone and the spinner has not
 * arrived. */

interface LinkPendingIconProps {
  /** The icon shown at rest. Swapped out whole while the navigation runs. */
  children: React.ReactNode;
  /** Match the icon being replaced, so the row does not move on the swap. */
  size?: number;
}

/**
 * Replaces a link's leading icon with a spinner while it is navigating.
 *
 * A swap rather than an addition: every one of these sits in a 1rem slot at the
 * head of a row, so putting the spinner in the icon's place is the only version
 * that costs no layout shift.
 */
export function LinkPendingIcon({ children, size = 16 }: LinkPendingIconProps) {
  const { pending } = useLinkStatus();

  if (!pending) return <>{children}</>;

  return <Loader2 className="link-spinner" size={size} aria-hidden />;
}

/**
 * A spinner for a link that has no icon to replace — the empty anchors
 * stretched over a card or a row, where there is nothing inside to swap.
 *
 * The CSS centres it over the card and dims what is underneath, so the whole
 * card reads as loading rather than one corner of it.
 */
export function LinkSpinner({ size = 18 }: { size?: number }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return <Loader2 className="link-spinner" size={size} aria-hidden />;
}
