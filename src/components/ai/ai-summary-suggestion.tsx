"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { summarizeDraft, summarizeItem } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { Button } from "@/components/ui/button";
import { UNREACHABLE } from "@/constants/messages";

interface AiSummarySuggestionProps {
  /**
   * The item being summarised, when there is one.
   *
   * Present in the drawer and absent in the create dialog, and that is what
   * picks the action — the same shape `AiTagSuggestions` has: an existing item
   * is named by id so the server reads its own row, while a draft has no row
   * and sends what has been typed.
   */
  itemId?: string;
  /** What has been typed so far, for the draft path. */
  draft: { title: string; content: string };
  /** What the field holds now — shown alongside, because accepting replaces it. */
  value: string;
  /** What the field is called for this type, so the copy can say it. */
  label: string;
  onAccept: (summary: string) => void;
}

/**
 * Asks the model to summarise the item and offers the answer for one click.
 *
 * **The difference from tags is that accepting replaces rather than merges.**
 * Tags are a set and a suggestion joins it; a description is one value and a
 * suggestion overwrites it. So the offer renders *beside* the field with the
 * current text still on screen and still editable, and accepting is an explicit
 * click on a button that says what it will do — someone who already wrote a
 * description has to be able to see what they are about to lose. Nothing is
 * replaced until that click, and Save is still Save.
 *
 * **Deliberately not optimistic**, for the reason the tag suggestions record:
 * there is nothing to be optimistic about when the value is unknown until the
 * model answers, and pretending otherwise would mean inventing prose.
 */
export function AiSummarySuggestion({
  itemId,
  draft,
  value,
  label,
  onAccept,
}: AiSummarySuggestionProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aiEnabled, setBudgetExceeded } = useBilling();

  const replacing = value.trim() !== "";

  /**
   * A draft with nothing in it has nothing to summarise. Checked here as well
   * as in the schema so an empty form does not spend a round trip — and one of
   * the caller's own hourly attempts — to be told so.
   */
  const empty =
    !itemId && draft.title.trim() === "" && draft.content.trim() === "";

  async function run() {
    setBusy(true);
    setError(null);

    try {
      // A failed *write* answers `{ success: false }`; a failed *request*
      // rejects. Without this the rejection is unhandled and the button stays
      // busy for good — the defect this project has shipped four times.
      const result = await (itemId
        ? summarizeItem({ itemId })
        : summarizeDraft({ ...draft, description: "", tags: [] })
      ).catch(() => null);

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

      setSummary(result.data);
    } finally {
      // The other half of the catch: whatever happened, the button works again.
      setBusy(false);
    }
  }

  // With AI off the button renders nothing, which would leave this wrapper as
  // an empty box under the field. The whole section goes instead.
  if (!aiEnabled) {
    return null;
  }

  return (
    <div className="ai-suggestions">
      <div className="ai-suggestions-bar">
        <AiSuggestButton
          label="AI summaries"
          title={
            empty
              ? "Add a title or some content first"
              : `Suggest a ${label.toLowerCase()} for this item`
          }
          busy={busy}
          disabled={empty}
          onSuggest={run}
        />
      </div>

      {busy && (
        // Shaped like the answer and sitting where it will appear, so the field
        // being typed in is never replaced underneath.
        <div className="ai-summary-pending" aria-hidden>
          <span />
          <span />
        </div>
      )}

      {!busy && summary && (
        <div className="ai-summary-offer">
          <p className="ai-summary-text">{summary}</p>

          <div className="ai-summary-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={() => {
                onAccept(summary);
                setSummary(null);
              }}
            >
              <Check size={14} aria-hidden />
              {/* Says what the click does, because it is destructive of what is
                  already there — "Accept" would not. */}
              <span>{replacing ? `Replace ${label}` : `Use as ${label}`}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ai-suggestions-dismiss"
              onClick={() => setSummary(null)}
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
