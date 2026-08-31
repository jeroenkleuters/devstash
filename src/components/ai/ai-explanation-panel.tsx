"use client";

import { Check, Copy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { explainCode } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { MarkdownPreview } from "@/components/items/markdown-editor";
import { Button } from "@/components/ui/button";
import { UNREACHABLE } from "@/constants/messages";

/** How long the copy button holds its confirmation, matching the item card's. */
const COPIED_MS = 2_000;

interface AiExplanationPanelProps {
  itemId: string;
}

/**
 * Asks the model what a snippet or command does, and shows the answer.
 *
 * **The one AI feature with no accept step.** There is no field an explanation
 * belongs in, so nothing is merged, nothing is written and Save is not
 * involved — it is read, optionally copied, and dismissed. That is also why it
 * lives in the drawer's *view* mode rather than in the form: the actual use is
 * opening a snippet you saved six months ago precisely because you no longer
 * remember what it does, which is not a moment you are editing anything.
 *
 * **Cleared when the drawer closes or a different item opens.** Both come for
 * free rather than from an effect: Radix unmounts `SheetContent` on close, and
 * the caller keys this on the item id, so switching items remounts it. An
 * explanation left over from the previous item would be worse than blank.
 *
 * **Not cached** — reopening re-asks. Deliberate for now; a cache keyed on
 * `item.updatedAt` is the shape if the wait or the cost starts to grate.
 *
 * **Deliberately not optimistic**, like the other AI features: there is nothing
 * to be optimistic about when the answer is unknown until the model gives it.
 */
export function AiExplanationPanel({ itemId }: AiExplanationPanelProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { aiEnabled, setBudgetExceeded } = useBilling();

  async function run() {
    setBusy(true);
    setError(null);

    try {
      // A failed *write* answers `{ success: false }`; a failed *request*
      // rejects. Without this the rejection is unhandled and the button stays
      // busy for good — the defect this project has shipped four times.
      const result = await explainCode({ itemId }).catch(() => null);

      if (!result?.success) {
        if (result && "budgetExceeded" in result && result.budgetExceeded) {
          setBudgetExceeded();
        }

        const message = result?.error ?? UNREACHABLE;

        // Inline and a toast: the drawer body scrolls, so an inline error can
        // sit off-screen while the button that caused it does not.
        setError(message);
        toast.error(message);
        return;
      }

      setExplanation(result.data);
    } finally {
      // The other half of the catch: whatever happened, the button works again.
      setBusy(false);
    }
  }

  async function copy() {
    if (!explanation) {
      return;
    }

    try {
      // Not `copyText` from `@/lib/item-copy`, which the spec named: that
      // extracts the *item's* payload, and what is being copied here is the
      // explanation. Only the clipboard call itself is shared, and it is one
      // line. The check alone is the confirmation — the button is directly
      // under the text it copied, unlike the card's, which toasts because it
      // may be anywhere on the page.
      await navigator.clipboard.writeText(explanation);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // Denied permission, or an insecure origin.
      toast.error("Could not copy to clipboard");
    }
  }

  // With AI off the button renders nothing, which would leave this as an empty
  // box under the code. The whole section goes instead.
  if (!aiEnabled) {
    return null;
  }

  return (
    <div className="ai-suggestions">
      <div className="ai-suggestions-bar">
        <AiSuggestButton
          label="AI code explanations"
          title="Explain what this code does"
          busy={busy}
          onSuggest={run}
        />
      </div>

      {busy && (
        // Shaped like the answer and sitting where it will appear, so the code
        // above is never replaced underneath.
        <div className="ai-explanation-pending" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}

      {!busy && explanation && (
        <div className="ai-explanation">
          {/* Through `MarkdownPreview`, which refuses raw HTML. Model output is
              untrusted content from a remote service and this is the one place
              a paragraph of it is rendered rather than put in an input's value
              — do not add `rehype-raw` here to make some formatting work. */}
          <MarkdownPreview value={explanation} />

          <div className="ai-explanation-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={copy}
            >
              {copied ? (
                <Check size={14} aria-hidden />
              ) : (
                <Copy size={14} aria-hidden />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={() => setExplanation(null)}
            >
              <X size={14} aria-hidden />
              <span>Dismiss</span>
            </Button>
          </div>
        </div>
      )}

      {error && <p className="ai-suggestions-error">{error}</p>}
    </div>
  );
}
