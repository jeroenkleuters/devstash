"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal } from "@/actions/billing";
import { useBilling } from "@/components/billing/billing-provider";
import { Button } from "@/components/ui/button";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/usage-limits";

/** Said when an action never answered, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

interface SettingsBillingProps {
  isPro: boolean;
  /** Whether the account has a Stripe customer, so the portal has something to open. */
  hasBilling: boolean;
  /** What `?checkout=` said, when the visitor has just come back from Stripe. */
  checkout?: "success" | "cancelled";
}

/**
 * The plan card: upgrade a free account, or open the portal for a Pro one.
 *
 * Neither button writes anything here. Checkout and the portal both answer with
 * a URL and the browser leaves; what happens at Stripe comes back as a webhook,
 * which is the only thing that sets `isPro`. So there is no optimistic state to
 * hold and nothing to render on success.
 *
 * Upgrading hands off to the shared upsell dialog rather than starting checkout
 * from here, so the plans and their amounts are stated in one place — the same
 * dialog a free account meets when it hits an item, collection or Pro-type gate.
 */
export function SettingsBilling({
  isPro,
  hasBilling,
  checkout,
}: SettingsBillingProps) {
  const { requestUpgrade } = useBilling();
  const [busy, startBusy] = useTransition();

  function leaveFor(run: () => Promise<{ success: boolean; url?: string; error?: string }>) {
    startBusy(async () => {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the button stays dead having said nothing.
      const result = await run().catch(() => null);

      if (!result?.success || !result.url) {
        toast.error(result?.error ?? UNREACHABLE);
        return;
      }

      // A full navigation rather than `router.push`: the destination is
      // Stripe's, not a route in this app.
      window.location.assign(result.url);
    });
  }

  return (
    <section className="settings-card" aria-busy={busy}>
      <div className="settings-row">
        <div className="settings-row-text">
          <h2 className="settings-card-title">Plan</h2>
          <p className="settings-row-description">
            {isPro
              ? "You are on Pro — unlimited items and collections, and file, image and book uploads."
              : `Free — up to ${FREE_ITEM_LIMIT} items and ${FREE_COLLECTION_LIMIT} collections, without uploads.`}
          </p>
        </div>

        <span className="settings-plan-badge" data-pro={isPro}>
          {isPro ? "Pro" : "Free"}
        </span>
      </div>

      {/* Checkout sends the browser back here. The webhook that grants Pro can
          still be in flight on this first render, so success is worded as
          received rather than as already applied. */}
      {checkout === "success" && !isPro && (
        <p className="settings-notice">
          Payment received. Your Pro features appear as soon as Stripe confirms
          it — reload in a moment if this still says Free.
        </p>
      )}

      {checkout === "cancelled" && (
        <p className="settings-notice">
          Checkout was cancelled. Nothing has been charged.
        </p>
      )}

      {isPro ? (
        <div className="settings-row">
          <div className="settings-row-text">
            <h3 className="settings-row-title">Billing</h3>
            <p className="settings-row-description">
              Change your plan, update your card or cancel your subscription in
              the Stripe billing portal.
            </p>
          </div>

          {hasBilling ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => leaveFor(() => openBillingPortal())}
            >
              Manage billing
            </Button>
          ) : (
            // Pro without a Stripe customer — granted directly on the row
            // rather than bought, which is how the seeded demo account is set
            // up. There is no portal session to open.
            <p className="settings-row-note">No subscription to manage</p>
          )}
        </div>
      ) : (
        <div className="settings-row">
          <div className="settings-row-text">
            <h3 className="settings-row-title">Upgrade to Pro</h3>
            <p className="settings-row-description">
              Unlimited items and collections, file and image uploads, and books.
              Cancel any time.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => requestUpgrade({ kind: "plan" })}
          >
            Upgrade
          </Button>
        </div>
      )}
    </section>
  );
}
