"use client";

import { Loader2, Lock, Sparkles } from "lucide-react";

import { useBilling } from "@/components/billing/billing-provider";
import { Button } from "@/components/ui/button";

interface AiSuggestButtonProps {
  /** Names the feature in the upsell, e.g. "AI tag suggestions". */
  label: string;
  /** Shown as the button's accessible name. */
  title: string;
  busy: boolean;
  /** Nothing to work on yet — inert, but still explains itself on hover. */
  disabled?: boolean;
  onSuggest: () => void;
}

/**
 * The trigger every AI feature uses, and the one place their gating lives.
 *
 * Three states that are not "enabled", and each renders differently on purpose:
 *
 * - **AI switched off** — it does not render *at all*. An off switch that
 *   leaves disabled buttons scattered around the app has not really turned
 *   anything off, which is the distinction `BillingProvider` documents on
 *   `aiEnabled`.
 * - **Free account** — it renders with `aria-disabled` and a lock, and is
 *   **never `disabled`**: a truly disabled button takes no click, and the
 *   upsell would be unreachable. Clicking raises the dialog. This is the
 *   pattern the free-tier gating feature established.
 * - **Budget spent** — inert with a tooltip saying so. `budgetExceeded` is held
 *   for the session by `BillingProvider`, so once one call has come back over
 *   budget the rest of them stop spending a round trip each to discover the
 *   same thing.
 *
 * All of it is presentation. The action re-checks every one of these server-side
 * and is the actual rule; this only decides what is on screen.
 */
export function AiSuggestButton({
  label,
  title,
  busy,
  disabled = false,
  onSuggest,
}: AiSuggestButtonProps) {
  const { aiEnabled, isPro, budgetExceeded, requestUpgrade } = useBilling();

  if (!aiEnabled) {
    return null;
  }

  const locked = !isPro;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="ai-suggest-button"
      // Never `disabled` for the locked case — see above. `busy` and
      // `budgetExceeded` are genuinely inert, but they stay aria-disabled too
      // so the button keeps its place in the tab order and can explain itself.
      aria-disabled={locked || busy || budgetExceeded || disabled}
      data-locked={locked || undefined}
      title={
        budgetExceeded
          ? "AI is paused for this month"
          : locked
            ? `${label} need Pro`
            : title
      }
      onClick={() => {
        if (busy || budgetExceeded || disabled) {
          return;
        }

        if (locked) {
          requestUpgrade({ kind: "ai", label });
          return;
        }

        onSuggest();
      }}
    >
      {busy ? (
        <Loader2 size={14} className="spinner" aria-hidden />
      ) : locked ? (
        <Lock size={14} aria-hidden />
      ) : (
        <Sparkles size={14} aria-hidden />
      )}
      <span className="action-label">{busy ? "Thinking…" : "Suggest"}</span>
    </Button>
  );
}
