"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { optimizePrompt } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { MarkdownEditor } from "@/components/items/markdown-editor";
import { Button } from "@/components/ui/button";
import { UNREACHABLE } from "@/constants/messages";
import type { OptimizedPrompt } from "@/lib/validations/ai";

interface AiOptimizablePromptProps {
  /**
   * The prompt being optimized. Absent in the create dialog, where the button
   * does not render at all — `optimizePrompt` names a saved id, so there is
   * nothing to ask about until the prompt exists. A draft variant is a
   * deliberate follow-up: it would need its own tighter rate limit and a hard
   * character cap, neither of which it inherits from a stored item.
   */
  itemId?: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/**
 * The Markdown editor for a prompt, with an Optimize button in its title bar
 * and the rewrite offered underneath.
 *
 * **It wraps the editor rather than sitting beside it**, the shape
 * `AiExplainableCode` established: the button belongs in the frame's bar, where
 * the actions on the content live, and the state behind it belongs with the
 * panel it produces — so one component owns both ends and the form only has to
 * name the field.
 *
 * **The rewrite does not share the frame the way an explanation does**, and
 * that is the difference between the two features. An explanation is another
 * view of the same code, so it takes a tab; a rewrite has to be read *against*
 * the original, so both are on screen at once and neither can be the tab the
 * other hides.
 *
 * **This is the one place where "replace the field and offer undo" is the
 * wrong shape**, and it is worth being explicit because it is the obvious
 * implementation. If the rewrite replaces the content, the user cannot compare
 * it against what they can no longer see; undo does not fix that, because it
 * restores a value they were never able to weigh. Nothing changes until an
 * explicit Accept, and Save is still Save.
 *
 * **The notes are part of the product, not decoration.** They cost a handful
 * of output tokens and are the difference between trusting a rewrite and
 * reverting it.
 *
 * **No diff highlighting.** A word-level diff of prose is noisy and usually
 * misleading, and the notes are the readable version of the same information.
 */
export function AiOptimizablePrompt({
  itemId,
  value,
  onChange,
  ariaLabel,
}: AiOptimizablePromptProps) {
  const [result, setResult] = useState<OptimizedPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aiEnabled, setBudgetExceeded } = useBilling();

  /**
   * Nothing written yet is nothing to rewrite. Checked here as well as in the
   * action so an empty field does not spend a round trip — and one of the
   * caller's own hourly attempts — to be told so.
   */
  const empty = value.trim() === "";

  async function run() {
    if (!itemId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // A failed *write* answers `{ success: false }`; a failed *request*
      // rejects. Without this the rejection is unhandled and the button stays
      // busy for good — the defect this project has shipped four times.
      const answer = await optimizePrompt({ itemId }).catch(() => null);

      if (!answer?.success) {
        if (answer && "budgetExceeded" in answer && answer.budgetExceeded) {
          setBudgetExceeded();
        }

        const message = answer?.error ?? UNREACHABLE;

        // Inline and a toast: the drawer body scrolls, so an inline error can
        // sit off-screen while the button that caused it does not.
        setError(message);
        toast.error(message);
        return;
      }

      setResult(answer.data);
    } finally {
      // The other half of the catch: whatever happened, the button works again.
      setBusy(false);
    }
  }

  // No saved item to name, or AI switched off — either way there is no button,
  // and the bar keeps just its format label and Copy.
  const offered = Boolean(itemId) && aiEnabled;

  return (
    <>
      <MarkdownEditor
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel}
        barExtra={
          offered ? (
            <AiSuggestButton
              label="AI prompt optimization"
              title={
                empty
                  ? "Write the prompt first"
                  : "Rewrite this prompt to be clearer"
              }
              action="Optimize"
              busy={busy}
              disabled={empty}
              onSuggest={run}
            />
          ) : undefined
        }
      />

      {busy && (
        // Two panes where the two panes will be, so the block does not jump
        // when the rewrite lands.
        <div className="ai-optimize-pending" aria-hidden>
          <span />
          <span />
        </div>
      )}

      {!busy && result && (
        <div className="ai-optimize-offer">
          <div className="ai-optimize-panes">
            <section className="ai-optimize-pane">
              <h4 className="ai-optimize-pane-title">Original</h4>
              {/* Both panes cap at the same height and scroll on their own, so
                  a long prompt cannot push the buttons off screen. */}
              <p className="ai-optimize-text">{value}</p>
            </section>

            <section className="ai-optimize-pane" data-optimized>
              <h4 className="ai-optimize-pane-title">Optimized</h4>
              <p className="ai-optimize-text">{result.optimized}</p>
            </section>
          </div>

          {result.notes.length > 0 && (
            <div className="ai-optimize-notes">
              <h4 className="ai-optimize-pane-title">What changed</h4>
              <ul>
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="ai-summary-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={() => {
                onChange(result.optimized);
                setResult(null);
              }}
            >
              <Check size={14} aria-hidden />
              {/* Says what the click does, because it is destructive of what is
                  already there — "Accept" would not. */}
              <span>Replace prompt</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={() => setResult(null)}
            >
              <X size={14} aria-hidden />
              <span>Dismiss</span>
            </Button>
          </div>
        </div>
      )}

      {error && <p className="ai-suggestions-error">{error}</p>}
    </>
  );
}
