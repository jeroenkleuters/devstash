"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { detectLanguage, detectLanguageForDraft } from "@/actions/ai";
import { AiSuggestButton } from "@/components/ai/ai-suggest-button";
import { useBilling } from "@/components/billing/billing-provider";
import { Label } from "@/components/ui/label";
import { UNREACHABLE } from "@/constants/messages";
import { DEFAULT_LANGUAGE, languageLabel } from "@/lib/code-language";

interface AiLanguageDetectProps {
  /**
   * The item being edited, when there is one.
   *
   * Present in the drawer and absent in the create dialog, and that is what
   * picks the action: an existing item is named by id so the server reads its
   * own row, while a draft has no row and sends what has been typed.
   */
  itemId?: string;
  /** The content to read, for the draft path. */
  content: string;
  /** Pairs the label with the select this wraps. */
  htmlFor: string;
  /** Selects the detected id in the dropdown. */
  onDetect: (language: string) => void;
  /** The select itself, so the button can sit on the label's row. */
  children: ReactNode;
}

/**
 * Asks the model what language the content is and selects it.
 *
 * **It applies the answer directly rather than offering it**, which is the one
 * place this differs from the tag and summary features. Those offer, because a
 * suggestion replacing prose would lose what was there; a language is a single
 * token the dropdown goes on displaying, so the result is visible and reverting
 * it is one click. Nothing is written either way — the field is local state
 * until Save, exactly as if it had been chosen by hand.
 *
 * It owns the `Label` and takes the select as `children` because the button and
 * the field are two ends of one control and no component can render into two
 * places at once.
 */
export function AiLanguageDetect({
  itemId,
  content,
  htmlFor,
  onDetect,
  children,
}: AiLanguageDetectProps) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { setBudgetExceeded } = useBilling();

  /**
   * Nothing to read. Checked here as well as in the schema so an empty editor
   * does not spend a round trip — and one of the caller's own hourly attempts —
   * to be told so.
   */
  const empty = content.trim() === "";

  async function run() {
    setBusy(true);
    setNote(null);

    try {
      // The action answers a failed *write* with `{ success: false }`, but a
      // failed *request* rejects instead. Without this the rejection is
      // unhandled and the button is left permanently busy — a defect that has
      // shipped and been fixed four separate times in this project.
      const result = await (itemId
        ? detectLanguage({ itemId })
        : detectLanguageForDraft({ content })
      ).catch(() => null);

      if (!result?.success) {
        // Once the month's budget is gone it stays gone, so the whole session
        // learns it and the other AI buttons stop trying.
        if (result && "budgetExceeded" in result && result.budgetExceeded) {
          setBudgetExceeded();
        }

        const message = result?.error ?? UNREACHABLE;

        setNote(message);
        toast.error(message);
        return;
      }

      onDetect(result.data);

      // `plaintext` is the escape hatch the prompt gives the model for code it
      // cannot place, so selecting it silently would present "I cannot tell" as
      // a confident answer. Every other id speaks for itself in the dropdown.
      setNote(
        result.data === DEFAULT_LANGUAGE
          ? "Could not tell what language this is."
          : `Detected ${languageLabel(result.data)}.`,
      );
    } finally {
      // The other half of the catch above: whatever happened, the button is
      // clickable again.
      setBusy(false);
    }
  }

  return (
    <>
      <div className="item-form-field-header">
        <Label htmlFor={htmlFor}>Language</Label>

        <AiSuggestButton
          label="AI language detection"
          title={empty ? "Add some code first" : "Detect the language"}
          action="Detect"
          busy={busy}
          disabled={empty}
          onSuggest={run}
        />
      </div>

      {children}

      {note && <p className="item-form-hint">{note}</p>}
    </>
  );
}
