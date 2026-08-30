"use client";

import { useBilling } from "@/components/billing/billing-provider";
import { Button } from "@/components/ui/button";

/**
 * The top bar's "Upgrade" button, opening the shared upsell dialog.
 *
 * A client component of its own because `TopBar` is a server component and this
 * needs `useBilling()` — the same reason the two create dialogs construct their
 * own triggers rather than taking one as a prop.
 *
 * It renders nothing for a Pro account: there is nothing left to sell, and the
 * settings card is where a subscription is managed.
 */
export function UpgradeTrigger({ label = "Upgrade" }: { label?: string }) {
  const { isPro, requestUpgrade } = useBilling();

  if (isPro) {
    return null;
  }

  return (
    // No icon, so the label is not wrapped in `.action-label` the way its
    // neighbours are: that class hides the text below the breakpoint, which
    // works only for a button with an icon left to show.
    <Button
      variant="ghost"
      size="lg"
      onClick={() => requestUpgrade({ kind: "plan" })}
    >
      {label}
    </Button>
  );
}
