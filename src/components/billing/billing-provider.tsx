"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import {
  UpgradeDialog,
  type UpgradeReason,
} from "@/components/billing/upgrade-dialog";
import type { ClientUsageSnapshot } from "@/lib/usage-limits";

interface BillingContextValue extends ClientUsageSnapshot {
  isPro: boolean;
  /**
   * Whether the account wants AI features offered at all.
   *
   * Rides the same path `isPro` takes because it answers the same kind of
   * question for the same controls — but it is a stronger answer: a gated
   * control renders inert and offers an upgrade, while an AI control with this
   * false **does not render at all**. An off switch that leaves disabled
   * buttons scattered around has not really turned anything off.
   *
   * The server check every AI action makes is the rule; this only decides what
   * is on screen, and is what keeps a stale page from being the only guard.
   */
  aiEnabled: boolean;
  /**
   * Whether this month's AI budget is gone.
   *
   * Held for the session rather than re-asked, because the answer cannot change
   * until the month turns: once one call has come back over budget, every AI
   * button goes inert instead of spending a round trip each to discover the
   * same thing. It starts false and is only ever set by an action's reply — the
   * page never reads the ledger itself.
   */
  budgetExceeded: boolean;
  /** Called by an AI feature whose call was refused for budget. */
  setBudgetExceeded: () => void;
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
  aiEnabled,
  usage,
  children,
}: {
  isPro: boolean;
  aiEnabled: boolean;
  usage: ClientUsageSnapshot;
  children: ReactNode;
}) {
  const [reason, setReason] = useState<UpgradeReason | null>(null);
  const [budgetExceeded, setBudgetExceeded] = useState(false);

  return (
    <BillingContext.Provider
      value={{
        isPro,
        aiEnabled,
        budgetExceeded,
        setBudgetExceeded: () => setBudgetExceeded(true),
        ...usage,
        requestUpgrade: setReason,
      }}
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
