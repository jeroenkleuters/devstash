"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import {
  UpgradeDialog,
  type UpgradeReason,
} from "@/components/billing/upgrade-dialog";
import type { ClientUsageSnapshot } from "@/lib/usage-limits";

interface BillingContextValue extends ClientUsageSnapshot {
  isPro: boolean;
  /** Opens the upsell, naming what the visitor just reached for. */
  requestUpgrade: (reason: UpgradeReason) => void;
}

const BillingContext = createContext<BillingContextValue | null>(null);

/**
 * Holds what a free account may still create, and owns the one upsell dialog
 * the whole shell shares.
 *
 * One instance rather than a dialog per gated control, for the same reason
 * `ItemDrawerProvider` holds one sheet: the pages rendering those controls are
 * server components, and a dialog per create button would put a portal behind
 * every one of them to show at most one.
 *
 * The counts are a snapshot of the render that produced them. A create refreshes
 * the route afterwards, which is what brings them back up to date; the server
 * gates in `createItem` / `createCollection` are the real rule, and this only
 * decides what the buttons look like.
 */
export function BillingProvider({
  isPro,
  usage,
  children,
}: {
  isPro: boolean;
  usage: ClientUsageSnapshot;
  children: ReactNode;
}) {
  const [reason, setReason] = useState<UpgradeReason | null>(null);

  return (
    <BillingContext.Provider
      value={{ isPro, ...usage, requestUpgrade: setReason }}
    >
      {children}

      <UpgradeDialog
        reason={reason}
        onOpenChange={(open) => {
          if (!open) setReason(null);
        }}
      />
    </BillingContext.Provider>
  );
}

export function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);

  if (!value) {
    throw new Error("useBilling must be used within BillingProvider");
  }

  return value;
}
