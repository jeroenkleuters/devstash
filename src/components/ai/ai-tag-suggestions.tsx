"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { suggestTags, suggestTagsForDraft } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { Button } from "@/components/ui/button";
import { UNREACHABLE } from "@/constants/messages";

interface AiTagSuggestionsProps {
  /**
   * The item being edited, when there is one.
   *
   * Present in the drawer and absent in the create dialog, and that is what
   * picks the action: an existing item is named by id so the server reads its
   * own row, while a draft has no row and sends what has been typed.
   */
  itemId?: string;
  /** What has been typed so far, for the draft path. */
  draft: { title: string; description: string; content: string };
  /** The comma-separated field value, so a suggestion already there is hidden. */
  value: string;
  /** Appends an accepted tag to the field. */
  onAccept: (tag: string) => void;
}

/**
 * Asks the model for tags and offers them as chips.
 *
 * **Suggest-and-accept, and nothing here writes.** The action returns strings,
 * accepting one appends it to the form's local state, and the existing
 * `updateItem` stores it when the user presses Save. Save is still Save.
 *
 * Each chip is individually clickable rather than an all-or-nothing Accept:
 * taking three of five is the common case, and an all-or-nothing button makes
 * the feature annoying enough not to use.
 *
 * **Deliberately not optimistic.** `useFlagToggle` is optimistic because a star
 * that waits on a round trip reads as a click that did not register — here the
 * opposite holds, because the value is unknown until the model answers and
 * pretending otherwise would mean inventing tags. So it gets a real loading
 * state instead.
 */
export function AiTagSuggestions({
  itemId,
  draft,
  value,
  onAccept,
}: AiTagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { aiEnabled, setBudgetExceeded } = useBilling();

  /** What the field already holds, so an accepted chip disappears from the set. */
  const taken = new Set(
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  );

  const offered = suggestions?.filter((tag) => !taken.has(tag)) ?? null;

  /**
   * A draft with nothing in it has nothing to suggest from. Checked here as
   * well as in the schema so an empty form does not spend a round trip — and
   * one of the caller's own hourly attempts — to be told so.
   */
  const empty =
    !itemId && draft.title.trim() === "" && draft.content.trim() === "";

  async function run() {
    setBusy(true);
    setError(null);

    try {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the button is left permanently busy — a defect that has
      // shipped and been fixed four separate times in this project.
      const result = await (itemId
        ? suggestTags({ itemId })
        : suggestTagsForDraft({ ...draft, tags: [...taken] })
      ).catch(() => null);

      if (!result?.success) {
        // Once the month's budget is gone it stays gone, so the whole session
        // learns it and the other AI buttons stop trying.
        if (result && "budgetExceeded" in result && result.budgetExceeded) {
          setBudgetExceeded();
        }

        const message = result?.error ?? UNREACHABLE;

        // Inline *and* a toast: the drawer body scrolls, so an inline error can
        // sit off-screen while the button that caused it does not.
        setError(message);
        toast.error(message);
        return;
      }

      if (result.data.length === 0) {
        setError("No new tags to suggest for this item.");
        return;
      }

      setSuggestions(result.data);
    } finally {
      // The other half of the catch above: whatever happened, the button is
      // clickable again.
      setBusy(false);
    }
  }

  // With AI off the button hides itself, which would otherwise leave this
  // wrapper behind as an empty box below the Tags hint — visible as a gap
  // rather than as nothing. The whole section goes instead.
  if (!aiEnabled) {
    return null;
  }

  return (
    <div className="ai-suggestions">
      <div className="ai-suggestions-bar">
        <AiSuggestButton
          label="AI tag suggestions"
          title={
            empty
              ? "Add a title or some content first"
              : "Suggest tags for this item"
          }
          busy={busy}
          disabled={empty}
          onSuggest={run}
        />

        {offered && offered.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ai-suggestions-dismiss"
            onClick={() => setSuggestions(null)}
          >
            <X size={14} aria-hidden />
            <span className="action-label">Dismiss</span>
          </Button>
        )}
      </div>

      {busy && (
        // Shaped like the answer rather than a spinner in the middle of
        // nowhere — the pattern the dashboard skeletons established. It sits
        // where the chips will be, so the field the user may be typing in is
        // never replaced underneath them.
        <div className="ai-suggestions-list" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ai-suggestion-chip ai-suggestion-pending" />
          ))}
        </div>
      )}

      {!busy && offered && offered.length > 0 && (
        <div className="ai-suggestions-list">
          {offered.map((tag) => (
            <button
              key={tag}
              type="button"
              className="ai-suggestion-chip"
              onClick={() => onAccept(tag)}
            >
              <Plus size={12} aria-hidden />
              {tag}
            </button>
          ))}
        </div>
      )}

      {error && <p className="ai-suggestions-error">{error}</p>}
    </div>
  );
}
