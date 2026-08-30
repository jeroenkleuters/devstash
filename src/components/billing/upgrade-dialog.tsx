"use client";

import { Check, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { startCheckout } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLAN_PRICING } from "@/constants/pricing";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/usage-limits";
import { BILLING_PLANS, type BillingPlan } from "@/types/billing";

/** Said when the action never answered, so it named no reason. */
const UNREACHABLE = "Could not reach the server. Try again.";

/**
 * Why the dialog was opened. A Pro type carries its own label ("Files"), since
 * the copy names the feature the visitor just reached for.
 */
export type UpgradeReason =
  | { kind: "items" }
  | { kind: "collections" }
  | { kind: "type"; label: string }
  /** Asked for outright from the settings card, rather than by hitting a gate. */
  | { kind: "plan" };

/** What Pro gives, listed once. */
const BENEFITS = [
  "Unlimited items and collections",
  "File, image and book uploads",
  "Everything you have already saved stays as it is",
];

function headline(reason: UpgradeReason): { title: string; body: string } {
  switch (reason.kind) {
    case "items":
      return {
        title: "You have reached the free item limit",
        body: `Free accounts hold up to ${FREE_ITEM_LIMIT} items. Upgrade to Pro to keep saving.`,
      };
    case "collections":
      return {
        title: "You have reached the free collection limit",
        body: `Free accounts hold up to ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro to keep organising.`,
      };
    case "type":
      return {
        title: `${reason.label} are a Pro feature`,
        body: `${reason.label} need a Pro subscription, because they are stored as uploads.`,
      };
    case "plan":
      return {
        title: "Upgrade",
        body: "Pick a plan and continue to checkout. Cancel any time.",
      };
  }
}

interface UpgradeDialogProps {
  /** The reason to show, or null when the dialog is closed. */
  reason: UpgradeReason | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The upsell. One instance for the whole shell, opened by `useBilling()`.
 *
 * It writes nothing: checkout answers with a URL and the browser leaves, and
 * what happens at Stripe comes back as a webhook — the only thing that sets
 * `isPro`. So there is no optimistic state here and nothing to render on
 * success.
 */
export function UpgradeDialog({ reason, onOpenChange }: UpgradeDialogProps) {
  const [plan, setPlan] = useState<BillingPlan>("monthly");
  const [busy, startBusy] = useTransition();

  // Radix unmounts the content on close, so the reason is only read while open
  // and the copy never renders against a stale one.
  const copy = reason ? headline(reason) : null;

  function upgrade() {
    startBusy(async () => {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the button stays dead having said nothing.
      const result = await startCheckout({ plan }).catch(() => null);

      if (!result?.success) {
        toast.error(result?.error ?? UNREACHABLE);
        return;
      }

      // A full navigation rather than `router.push`: the destination is
      // Stripe's, not a route in this app.
      window.location.assign(result.url);
    });
  }

  return (
    <Dialog open={reason !== null} onOpenChange={onOpenChange}>
      <DialogContent className="upgrade-dialog">
        <DialogHeader>
          <DialogTitle>{copy?.title ?? "Upgrade to Pro"}</DialogTitle>
          <DialogDescription>{copy?.body}</DialogDescription>
        </DialogHeader>

        <ul className="upgrade-benefits">
          {BENEFITS.map((benefit) => (
            <li key={benefit}>
              <Check size={16} aria-hidden />
              {benefit}
            </li>
          ))}
        </ul>

        <fieldset className="upgrade-plans">
          <legend className="upgrade-plans-legend">Choose a plan</legend>

          {BILLING_PLANS.map((option) => {
            const pricing = PLAN_PRICING[option];

            return (
              <label key={option} className="upgrade-plan">
                {/* A real radio kept inside its label, so the group keeps the
                    keyboard behaviour a div would have to reimplement. */}
                <input
                  type="radio"
                  name="upgrade-plan"
                  value={option}
                  checked={option === plan}
                  onChange={() => setPlan(option)}
                  disabled={busy}
                />
                <span className="upgrade-plan-label">{pricing.label}</span>
                <span className="upgrade-plan-amount">{pricing.amount}</span>
                <span className="upgrade-plan-period">{pricing.period}</span>
                {pricing.note && (
                  <span className="upgrade-plan-note">{pricing.note}</span>
                )}
              </label>
            );
          })}
        </fieldset>

        <div className="upgrade-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>

          <Button type="button" disabled={busy} onClick={upgrade}>
            <Sparkles aria-hidden />
            {busy ? "Opening checkout…" : "Upgrade to Pro"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
